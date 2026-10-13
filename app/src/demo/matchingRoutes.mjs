export function matchingRolePageUrl(role, page = "matching", tripId) {
  const url = new URL(location.href);
  url.searchParams.set("preview", "app");
  url.searchParams.set("role", role);
  url.searchParams.set("page", page);
  url.searchParams.set("demo", "1");
  url.searchParams.set("matchingDemo", "1");
  if (role === "construction") url.searchParams.set("navigationReview", "1");
  else url.searchParams.delete("navigationReview");
  if (tripId) url.searchParams.set("matchTrip", tripId);
  else url.searchParams.delete("matchTrip");
  return url.href;
}
