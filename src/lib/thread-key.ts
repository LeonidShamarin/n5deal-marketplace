/**
 * The deduplication key for a conversation.
 *
 * It lives in its own module rather than beside the messaging actions because a
 * file marked "use server" may only export async functions — and because this is
 * pure logic that the unit tests exercise directly.
 *
 * "general" stands in for a thread that is not about a specific listing. A null
 * would have been the natural choice in the column itself, but Postgres treats
 * NULLs as distinct in a unique index, so two "general" threads between the same
 * pair would both be allowed. One non-null key removes the ambiguity.
 */
export function threadKey(
  assetId: string | null,
  buyerId: string,
  sellerId: string,
): string {
  return `${assetId ?? "general"}:${buyerId}:${sellerId}`;
}
