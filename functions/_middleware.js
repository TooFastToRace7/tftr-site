export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;

  const isLegacy =
    url.searchParams.has("add-to-cart") ||
    path.startsWith("/product/") ||
    path.startsWith("/product-category/") ||
    path.startsWith("/brand/") ||
    path.startsWith("/shop") ||
    path.startsWith("/wp-");

  if (isLegacy) {
    return new Response("Gone", {
      status: 410,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return context.next();
}
