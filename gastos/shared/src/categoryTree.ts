import { MAX_CATEGORY_DEPTH } from './constants';

/** Pure helpers over the category tree. No database, no framework. */

export interface TreeNode {
  id: string;
  parentId: string | null;
}

function indexById<T extends TreeNode>(nodes: readonly T[]): Map<string, T> {
  return new Map(nodes.map((node) => [node.id, node]));
}

/** 1 for a root. A broken parent chain counts the levels it could walk. */
export function depthOf(id: string, nodes: readonly TreeNode[]): number {
  const byId = indexById(nodes);
  let depth = 0;
  let current = byId.get(id);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    depth += 1;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return depth;
}

/** Levels below and including the node: 1 for a leaf. */
export function subtreeHeight(id: string, nodes: readonly TreeNode[]): number {
  const children = nodes.filter((node) => node.parentId === id);
  if (children.length === 0) return 1;
  return 1 + Math.max(...children.map((child) => subtreeHeight(child.id, nodes)));
}

export function descendantIds(id: string, nodes: readonly TreeNode[]): string[] {
  const direct = nodes.filter((node) => node.parentId === id).map((node) => node.id);
  return direct.flatMap((childId) => [childId, ...descendantIds(childId, nodes)]);
}

/** Why a node cannot be placed under newParentId, or null when it can. */
export function moveProblem(
  id: string,
  newParentId: string | null,
  nodes: readonly TreeNode[],
): 'self' | 'cycle' | 'too_deep' | null {
  if (newParentId === null) return null;
  if (newParentId === id) return 'self';
  if (descendantIds(id, nodes).includes(newParentId)) return 'cycle';
  if (depthOf(newParentId, nodes) + subtreeHeight(id, nodes) > MAX_CATEGORY_DEPTH) return 'too_deep';
  return null;
}

/** Names from the root down to the node, e.g. ["Vivienda", "Servicios", "Luz"]. */
export function pathOf<T extends TreeNode & { name: string }>(id: string, nodes: readonly T[]): string[] {
  const byId = indexById(nodes);
  const names: string[] = [];
  let current = byId.get(id);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return names;
}
