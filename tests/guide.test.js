import { CONFIG } from '../js/config.js';
import { getPostureGuideForMode, MODE_POSTURE_GUIDES } from '../js/ui/postureGuides.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
  }
}

function runTests() {
  console.log('--- Testing Mode-Specific Posture Guides ---');
  const modes = Object.values(CONFIG.MODES);

  for (const mode of modes) {
    const g = getPostureGuideForMode(mode);
    assert(
      g && typeof g.title === 'string' && Array.isArray(g.cards) && g.cards.length >= 2,
      `Mode ${mode} defines a dedicated posture guide (${g.cards.length} cards)`
    );
    assert(
      g.cards.every((c) => c.svg.includes('viewBox="0 0 100 100"') && c.svg.includes('xmlns="http://www.w3.org/2000/svg"')),
      `All guide SVG illustrations for ${mode} declare valid viewBox and xmlns`
    );
  }

  // Strict per-mode isolation checks (never bleed unrelated mode moves!)
  const classicTitles = getPostureGuideForMode('CLASSIC').cards.map((c) => c.title).join('|');
  assert(
    classicTitles.includes('시옷') && !classicTitles.includes('Y자'),
    'CLASSIC guide shows only consonant ultimates without Doctor Strange Y-pose'
  );

  const strangeTitles = getPostureGuideForMode('DOCTOR_STRANGE').cards.map((c) => c.title).join('|');
  assert(
    strangeTitles.includes('Y자') && !strangeTitles.includes('시옷') && !strangeTitles.includes('기역'),
    'DOCTOR_STRANGE guide shows only beam & Y-pose without consonant moves'
  );

  const umbrellaTitles = getPostureGuideForMode('UMBRELLA').cards.map((c) => c.title).join('|');
  assert(
    umbrellaTitles.includes('우산') && !umbrellaTitles.includes('점프') && !umbrellaTitles.includes('시소'),
    'UMBRELLA guide shows only hand umbrella controls'
  );

  const crossyTitles = getPostureGuideForMode('CROSSY').cards.map((c) => c.title).join('|');
  assert(
    crossyTitles.includes('점프') && crossyTitles.includes('날개짓') && !crossyTitles.includes('우산'),
    'CROSSY guide shows only jump & wing flap controls'
  );

  const redLightTitles = getPostureGuideForMode('RED_LIGHT').cards.map((c) => c.title).join('|');
  assert(
    redLightTitles.includes('점프') && redLightTitles.includes('얼음') && redLightTitles.includes('만세'),
    'RED_LIGHT guide shows run/jump, freeze, and manse tag moves'
  );

  const breakoutTitles = getPostureGuideForMode('BREAKOUT').cards.map((c) => c.title).join('|');
  assert(
    breakoutTitles.includes('양손') && breakoutTitles.includes('시소'),
    'BREAKOUT guide shows only two-hand movement & wrist-height seesaw tilt'
  );

  assert(Object.keys(MODE_POSTURE_GUIDES).length === modes.length, 'Every CONFIG.MODES entry has its own isolated guide');

  console.log(`\nGuide Tests Complete: ${passed}/${total} passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
