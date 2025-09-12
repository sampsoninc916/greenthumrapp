export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);

      // Return environment configuration
      if (url.pathname === '/env-config') {
        return new Response(
          JSON.stringify({
            AWS_USER_POOL_ID: env.AWS_USER_POOL_ID,
            AWS_USER_POOL_CLIENT_ID: env.AWS_USER_POOL_CLIENT_ID,
            AWS_REGION: env.AWS_REGION,
            API_PLANTS_READ: env.API_PLANTS_READ,
            API_PLANTS_WRITE: env.API_PLANTS_WRITE,
            API_PLANTS_UPDATE: env.API_PLANTS_UPDATE,
            API_USERS_READ: env.API_USERS_READ,
            API_USERS_WRITE: env.API_USERS_WRITE,
            API_USERS_UPDATE: env.API_USERS_UPDATE,
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Serve static asset from the assets binding
      let response = await env.ASSETS.fetch(request);

      // SPA fallback: if not found and path has no file extension, serve index.html
      if (response.status === 404 && !new URL(request.url).pathname.includes('.')) {
        response = await env.ASSETS.fetch(new Request('index.html', request));
      }
      return response;
    } catch {
      return new Response('Internal Error', { status: 500 });
    }
  }
};

export interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  AWS_USER_POOL_ID: string;
  AWS_USER_POOL_CLIENT_ID: string;
  AWS_REGION: string;
  API_PLANTS_READ: string;
  API_PLANTS_WRITE: string;
  API_PLANTS_UPDATE: string;
  API_USERS_READ: string;
  API_USERS_WRITE: string;
  API_USERS_UPDATE: string;
}
