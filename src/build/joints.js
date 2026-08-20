import { RAPIER } from '../physics/world.js';
import { partDef } from './parts.js';

function v3(x, y, z) {
  return { x, y, z };
}

function quatIdentity() {
  return { x: 0, y: 0, z: 0, w: 1 };
}

function quatConjugate(q) {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

function quatMul(a, b) {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

export function makeJointData(type, a1, a2, axis, bodyAQuat, bodyBQuat) {
  const ax = axis || { x: 0, y: 1, z: 0 };
  if (type === 'hinge') return RAPIER.JointData.revolute(a1, a2, ax);
  if (type === 'slider') return RAPIER.JointData.prismatic(a1, a2, ax);
  if (type === 'spring') return RAPIER.JointData.spring(0.35, 80, 6, a1, a2);
  // Freeze the *current* relative rotation: a fixed joint with identity frame
  // quaternions forces both bodies to equal orientations, so connecting a
  // yawed part to an un-yawed one kicks the machine apart at launch.
  let q2 = quatIdentity();
  if (bodyAQuat && bodyBQuat) q2 = quatMul(quatConjugate(bodyBQuat), bodyAQuat);
  return RAPIER.JointData.fixed(a1, quatIdentity(), a2, q2);
}

export function portAnchor(partType, portId) {
  const p = partDef(partType).ports.find((x) => x.id === portId);
  if (!p) return v3(0, 0, 0);
  return v3(p.x, p.y, p.z);
}

export function portAxis(partType, portId) {
  const p = partDef(partType).ports.find((x) => x.id === portId);
  if (!p) return v3(0, 1, 0);
  return v3(p.ax, p.ay, p.az);
}

export function jointTypeFromPorts(pa, pb) {
  if (pa?.type === 'hinge' || pb?.type === 'hinge') return 'hinge';
  if (pa?.type === 'spring' || pb?.type === 'spring') return 'spring';
  if (pa?.type === 'slider' || pb?.type === 'slider') return 'slider';
  return 'fixed';
}

export function createJoint(world, partA, portA, partB, portB) {
  const da = partDef(partA.type);
  const db = partDef(partB.type);
  const pa = da.ports.find((x) => x.id === portA);
  const pb = db.ports.find((x) => x.id === portB);
  const type = jointTypeFromPorts(pa, pb);
  const axis = pa?.type === 'hinge' || pa?.type === 'slider'
    ? { x: pa.ax, y: pa.ay, z: pa.az }
    : pb
      ? { x: pb.ax, y: pb.ay, z: pb.az }
      : { x: 0, y: 1, z: 0 };
  const data = makeJointData(
    type,
    portAnchor(partA.type, portA),
    portAnchor(partB.type, portB),
    axis,
    partA.body.rotation(),
    partB.body.rotation(),
  );
  const joint = world.createImpulseJoint(data, partA.body, partB.body, true);
  try { joint.setContactsEnabled(false); } catch (_) { /* */ }
  return { joint, type, portA, portB, a: partA.id, b: partB.id, axis };
}
