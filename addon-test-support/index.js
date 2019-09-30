import { getContext } from '@ember/test-helpers';
import { resolve } from 'rsvp';
import { run } from '@ember/runloop';
import { relativeBounds } from 'ember-animated/-private/bounds';
import { cumulativeTransform } from 'ember-animated/-private/transform';
import TimeControl from './time-control';

export { TimeControl };
export { default as MotionTester } from './motion-tester';

export function animationsSettled() {
  let idle;
  let { owner } = getContext();
  run(() => {
    idle = owner.lookup('service:-ea-motion').get('waitUntilIdle').perform();
  });
  return resolve(idle);
}

// This is like getBoundingClientRect, but it is relative to the
// #ember-testing container, so your answers don't change just because
// the container itself is being pushed around by QUnit.
export function bounds(element) {
  return relativeBounds(element.getBoundingClientRect(), document.querySelector('#ember-testing').getBoundingClientRect());
}

// This gives you the linear part of the cumulative transformations
// applies to the element, which together form a 2x2 matrix that
// determines its shape.
export function shape(element) {
  let transform = cumulativeTransform(element);
  return {
    a: transform.a,
    b: transform.b,
    c: transform.c,
    d: transform.d
  };
}

function checkFields(fields, tolerance, value, expected, message) {

  let filteredActual = Object.create(null);
  let filteredExpected = Object.create(null);
  fields.forEach(field => {
    filteredActual[field] = value[field];
    filteredExpected[field] = expected[field];
  });

  this.pushResult({
    result: fields.every(field => Math.abs(value[field] - expected[field]) < tolerance),
    actual: filteredActual,
    expected: filteredExpected,
    message: message
  });
}

export async function visuallyConstant(target, fn, message) {
  let before = Object.assign({}, bounds(target), shape(target));
  await fn();
  let after = Object.assign({}, bounds(target), shape(target));
  checkFields.call(this, ['a', 'b', 'c', 'd', 'top', 'left', 'width', 'height'], 0.25, before, after, message);
}

function parseComputedColor(c) {
  let m = /rgb\((\d+), (\d+), (\d+)\)/.exec(c);
  if (m) {
    return {
      r: parseInt(m[1]),
      g: parseInt(m[2]),
      b: parseInt(m[3]),
      a: 1
    };
  }
  m = /rgba\((\d+), (\d+), (\d+), (\d+(?:\.\d+)?)\)/.exec(c);
  if (m) {
    return {
      r: parseInt(m[1]),
      g: parseInt(m[2]),
      b: parseInt(m[3]),
      a: parseFloat(m[4])
    };
  }
}

function parseUserProvidedColor(c) {
  let testElement = document.createElement('div');
  testElement.style.display = 'none';
  testElement.style.color = c;
  document.body.appendChild(testElement);
  let result = parseComputedColor(getComputedStyle(testElement).color);
  testElement.remove();
  return result;
}

export function approxEqualColors(value, expected, message) {
  const tolerance = 3;
  let valueColor = parseUserProvidedColor(value);
  let expectedColor = parseUserProvidedColor(expected);
  let channels = ['r', 'g', 'b', 'a'];
  this.pushResult({
    result: channels.every(channel => Math.abs(valueColor[channel] - expectedColor[channel]) < tolerance),
    actual: value,
    expected,
    message,
  });
}

export let time;

export function setupAnimationTest(hooks) {
  hooks.beforeEach(function(assert) {
    time = new TimeControl();
    time.runAtSpeed(40);

    // equal checks use a quarter pixel tolerance because we don't care about rounding errors
    assert.equalPosition = checkFields.bind(assert, ['left', 'top'], 0.25);
    assert.equalSize = checkFields.bind(assert, ['height', 'width'], 0.25);
    assert.equalBounds = checkFields.bind(assert, ['height', 'left', 'top', 'width'], 0.25);

    // closeness checks accept a custom pixel tolerance
    assert.closePosition = checkFields.bind(assert, ['left', 'top']);
    assert.closeSize = checkFields.bind(assert, ['height', 'width']);
    assert.closeBounds = checkFields.bind(assert, ['height', 'left', 'top', 'width']);

    assert.visuallyConstant = visuallyConstant;
    assert.approxEqualColors = approxEqualColors;

  });
  hooks.afterEach(function() {
    time.finished();
    time = null;
  });
}
