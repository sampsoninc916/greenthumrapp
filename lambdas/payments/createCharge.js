import Stripe from "stripe";
import { parseJson, getRequestId } from "../common/request.js";
import { created, badRequest } from "../common/http.js";
import { handleError } from "../common/errors.js";
import { createLogger } from "../common/logger.js";
import { verifyAuth } from "../common/auth.js";
import { getDocumentClient } from "../common/dynamo.js";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

let stripeClient;

const getStripe = () => {
  if (!stripeClient) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }
    stripeClient = new Stripe(apiKey, {
      apiVersion: "2024-11-20",
    });
  }
  return stripeClient;
};

export const handler = async (event = {}) => {
  const requestId = getRequestId(event);
  const logger = createLogger({ requestId, handler: "createCharge" });

  try {
    const user = await verifyAuth(event);
    const body = parseJson(event);

    if (!body.amount || !body.currency || !body.paymentMethodId || !body.orderId) {
      return badRequest("Missing payment fields");
    }

    const stripe = getStripe();

    const intent = await stripe.paymentIntents.create({
      amount: body.amount,
      currency: body.currency,
      customer: body.customerId ?? undefined,
      payment_method: body.paymentMethodId,
      confirm: true,
      metadata: {
        orderId: body.orderId,
        buyerId: user.id,
      },
    });

    const client = getDocumentClient();
    await client.send(
      new PutCommand({
        TableName: process.env.TRANSACTIONS_TABLE,
        Item: {
          transactionId: intent.id,
          orderId: body.orderId,
          buyerId: user.id,
          amount: body.amount,
          currency: body.currency,
          status: intent.status,
          createdAt: new Date().toISOString(),
          provider: "stripe",
        },
      })
    );

    logger.info("Payment intent created", { orderId: body.orderId, intentId: intent.id });

    return created({
      paymentIntentId: intent.id,
      status: intent.status,
      clientSecret: intent.client_secret,
    });
  } catch (error) {
    return handleError(error, { handler: "createCharge", requestId });
  }
};
