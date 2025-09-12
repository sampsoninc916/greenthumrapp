export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
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
}
