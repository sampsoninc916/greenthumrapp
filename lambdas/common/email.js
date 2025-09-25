import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

let sesClient;

const getSesClient = () => {
  if (!sesClient) {
    sesClient = new SESv2Client({ region: process.env.AWS_REGION });
  }
  return sesClient;
};

export const sendTemplatedEmail = async ({ toAddress, templateName, templateData }) => {
  const source = process.env.EMAIL_SOURCE_ADDRESS;
  if (!source) {
    throw new Error("EMAIL_SOURCE_ADDRESS not configured");
  }

  const command = new SendEmailCommand({
    FromEmailAddress: source,
    Destination: {
      ToAddresses: [toAddress],
    },
    Content: {
      Template: {
        TemplateName: templateName,
        TemplateData: JSON.stringify(templateData ?? {}),
      },
    },
  });

  await getSesClient().send(command);
};
