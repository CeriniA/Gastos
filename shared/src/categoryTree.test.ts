import assert from 'node:assert/strict';
import { test } from 'node:test';
import { depthOf, descendantIds, moveProblem, pathOf, subtreeHeight } from './categoryTree';

const nodes = [
  { id: 'home', parentId: null, name: 'Vivienda' },
  { id: 'services', parentId: 'home', name: 'Servicios' },
  { id: 'power', parentId: 'services', name: 'Luz' },
  { id: 'rent', parentId: 'home', name: 'Alquiler' },
  { id: 'food', parentId: null, name: 'Supermercado' },
];

test('depth, height, descendants and path', () => {
  assert.equal(depthOf('home', nodes), 1);
  assert.equal(depthOf('power', nodes), 3);
  assert.equal(subtreeHeight('home', nodes), 3);
  assert.equal(subtreeHeight('rent', nodes), 1);
  assert.deepEqual(descendantIds('home', nodes).sort(), ['power', 'rent', 'services']);
  assert.deepEqual(pathOf('power', nodes), ['Vivienda', 'Servicios', 'Luz']);
});

test('moveProblem blocks cycles and trees deeper than three levels', () => {
  assert.equal(moveProblem('home', 'home', nodes), 'self');
  assert.equal(moveProblem('home', 'power', nodes), 'cycle');
  assert.equal(moveProblem('services', 'food', nodes), null); // food > services > power = 3 levels
  assert.equal(moveProblem('home', 'food', nodes), 'too_deep'); // would be 4 levels
  assert.equal(moveProblem('food', 'services', nodes), null);
  assert.equal(moveProblem('food', 'power', nodes), 'too_deep');
  assert.equal(moveProblem('power', null, nodes), null);
});
