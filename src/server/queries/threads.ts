import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * Reading conversations.
 *
 * Ownership is part of every query rather than a check performed afterwards:
 * `listThreadsFor` filters by participation, and `getThreadFor` includes the
 * viewer in its `where`. A thread the viewer is not in therefore comes back as
 * "not found", not as a row waiting for someone to remember to check it.
 */

const participantSelect = {
  id: true,
  name: true,
  status: true,
  role: true,
  sellerProfile: { select: { company: true, verified: true } },
  buyerProfile: { select: { company: true } },
} satisfies Prisma.UserSelect;

const threadListSelect = {
  id: true,
  lastMessageAt: true,
  buyerId: true,
  sellerId: true,
  asset: {
    select: {
      ref: true,
      title: true,
      country: true,
      category: true,
      askingPrice: true,
      currency: true,
      status: true,
    },
  },
  buyer: { select: participantSelect },
  seller: { select: participantSelect },
  messages: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { id: true, body: true, senderId: true, createdAt: true, readAt: true },
  },
  _count: { select: { messages: true } },
} satisfies Prisma.ThreadSelect;

export type ThreadListItem = Prisma.ThreadGetPayload<{ select: typeof threadListSelect }>;

export async function listThreadsFor(userId: string): Promise<ThreadListItem[]> {
  return db.thread.findMany({
    where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
    select: threadListSelect,
    orderBy: { lastMessageAt: "desc" },
    take: 100,
  });
}

/** How many conversations have an unread message from the other side. */
export async function countUnreadThreads(userId: string): Promise<number> {
  return db.thread.count({
    where: {
      OR: [{ buyerId: userId }, { sellerId: userId }],
      messages: { some: { senderId: { not: userId }, readAt: null } },
    },
  });
}

const threadDetailSelect = {
  id: true,
  buyerId: true,
  sellerId: true,
  createdAt: true,
  asset: {
    select: {
      ref: true,
      title: true,
      country: true,
      category: true,
      licenseType: true,
      askingPrice: true,
      currency: true,
      status: true,
    },
  },
  buyer: { select: participantSelect },
  seller: { select: participantSelect },
  messages: {
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true, body: true, senderId: true, createdAt: true, readAt: true },
  },
} satisfies Prisma.ThreadSelect;

export type ThreadDetail = Prisma.ThreadGetPayload<{ select: typeof threadDetailSelect }>;

export async function getThreadFor(
  threadId: string,
  userId: string,
): Promise<ThreadDetail | null> {
  return db.thread.findFirst({
    // Participation is in the WHERE clause, so a thread id belonging to someone
    // else simply does not exist as far as this query is concerned.
    where: { id: threadId, OR: [{ buyerId: userId }, { sellerId: userId }] },
    select: threadDetailSelect,
  });
}

/** The other party in a thread, from the viewer's point of view. */
export function counterpartOf<
  T extends { buyerId: string; buyer: unknown; seller: unknown },
>(thread: T, viewerId: string): T["buyer"] {
  return thread.buyerId === viewerId ? thread.seller : thread.buyer;
}
