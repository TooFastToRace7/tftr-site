export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;

  if (path === "/kawasaki-h2-parts" || path.startsWith("/kawasaki-h2-parts/")) {
    return Response.redirect(new URL("/kawasaki-h2/", url).toString(), 301);
  }

  if (path === "/about-us" || path === "/about-us/") {
    return Response.redirect(new URL("/about/", url).toString(), 301);
  }

  if (path === "/contact-us-2" || path === "/contact-us-2/") {
    return Response.redirect(new URL("/contact/", url).toString(), 301);
  }

  const isLegacy =
    url.searchParams.has("add-to-cart") ||
    path.startsWith("/product/") ||
    path.startsWith("/product-category/") ||
    path.startsWith("/brand/") ||
    path.startsWith("/shop") ||
    path.startsWith("/wp-") ||
    path.startsWith("/laba7") ||
    path.startsWith("/about-us/privacy-policy") ||
    path.startsWith("/personalized-setings");
  if (isLegacy) {
    return new Response("Gone", {
      status: 410,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return context.next();
}
