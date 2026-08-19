import { MATERIALS, GROUPS, interactionGroups, ALL_GROUPS } from '../config.js';

export function applyMaterial(collider, name) {
  const m = MATERIALS[name] || MATERIALS.stone;
  collider.setFriction(m.friction);
  collider.setRestitution(m.restitution);
}

export function worldFilter(extra = 0) {
  return interactionGroups(GROUPS.staticWorld, ALL_GROUPS | extra);
}

export function propFilter() {
  return interactionGroups(
    GROUPS.dynamicProps,
    GROUPS.staticWorld | GROUPS.dynamicProps | GROUPS.player | GROUPS.machine | GROUPS.water | GROUPS.fauna,
  );
}

export function playerFilter() {
  return interactionGroups(
    GROUPS.player,
    GROUPS.staticWorld | GROUPS.dynamicProps | GROUPS.machine | GROUPS.water | GROUPS.fauna | GROUPS.enemy,
  );
}

export function machineFilter() {
  return interactionGroups(
    GROUPS.machine,
    GROUPS.staticWorld | GROUPS.dynamicProps | GROUPS.player | GROUPS.machine | GROUPS.water | GROUPS.fauna,
  );
}

export function waterFilter() {
  return interactionGroups(GROUPS.water, GROUPS.dynamicProps | GROUPS.player | GROUPS.machine | GROUPS.fauna);
}

export function faunaFilter() {
  return interactionGroups(
    GROUPS.fauna,
    GROUPS.staticWorld | GROUPS.dynamicProps | GROUPS.player | GROUPS.machine | GROUPS.water | GROUPS.fauna,
  );
}

export function enemyFilter() {
  return interactionGroups(GROUPS.enemy, GROUPS.staticWorld | GROUPS.player | GROUPS.dynamicProps);
}

export function ghostFilter() {
  return interactionGroups(GROUPS.buildGhost, 0);
}
