import { FITTED_SKILL_PARAMETERS } from './fitted-parameters';
import { HINT_TRANSLATIONS } from './hint-translations';
import type { Exercise, Lesson, Pack, SkillSpec, Subject } from '../domain/types';

/** Fallback for any Skill without fitted parameters. */
export const DEFAULT_SKILL_PARAMETERS = { prior: 0.2, learn: 0.08, guess: 0.2, slip: 0.1 };

const skill = (id: string): SkillSpec => ({ id, parameters: { ...(FITTED_SKILL_PARAMETERS[id] ?? DEFAULT_SKILL_PARAMETERS) } });

/** Authoring shorthand: `answer` is the index of the correct option. */
type Q = [prompt: string, options: string[], answer: number];

function lesson(packId: string, slug: string, title: string, skillCode: string, body: string, hint: string, questions: Q[]): Lesson {
  const id = `${packId}.${slug}`;
  const exercises: Exercise[] = questions.map(([prompt, options, correctOption], i) => ({ id: `${id}.q${i + 1}`, lessonId: id, prompt, options, correctOption }));
  return { id, packId, title, skillCode, body, hints: { en: hint, ...HINT_TRANSLATIONS[id] }, exercises };
}

function pack(id: string, subject: Subject, title: string, skills: string[], lessons: Lesson[]): Pack {
  // The Starter Pack ships inside the app, so its answer key is already here and grading is instant.
  return { id, subject, title, grade: 5, version: '1.0.0', grading: 'ON_DEVICE', skills: skills.map(skill), lessons };
}

const math = pack('math5', 'MATH', 'Fractions & Decimals', ['math5.fractions.equivalent', 'math5.fractions.add', 'math5.decimals.place-value'], [
  lesson('math5', 'equivalent', 'Equivalent fractions', 'math5.fractions.equivalent',
    'Two fractions are equivalent when they name the same amount. Multiply or divide the top and the bottom by the same number and the value does not change. 1/2 = 2/4 = 3/6.',
    'Do the same thing to the numerator and the denominator. 1/2 times 2/2 gives 2/4.',
    [
      ['Which fraction is equivalent to 1/2?', ['2/4', '2/3', '1/3', '3/4'], 0],
      ['Which fraction is equivalent to 3/4?', ['6/10', '6/8', '4/6', '3/8'], 1],
      ['What number completes 2/3 = ?/12?', ['6', '8', '9', '10'], 1],
      ['Which fraction is equivalent to 4/6?', ['1/2', '3/4', '2/3', '4/12'], 2],
      ['Simplify 6/8.', ['2/3', '3/4', '1/2', '6/4'], 1],
      ['Which pair of fractions is equivalent?', ['1/3 and 2/5', '2/5 and 4/10', '3/4 and 4/5', '1/2 and 2/3'], 1],
      ['What number completes 5/10 = 1/?', ['2', '4', '5', '10'], 0],
      ['Which fraction is NOT equivalent to 1/4?', ['2/8', '3/12', '4/16', '2/6'], 3],
    ]),
  lesson('math5', 'add', 'Adding fractions', 'math5.fractions.add',
    'To add fractions with the same denominator, add the numerators and keep the denominator: 1/5 + 2/5 = 3/5. With different denominators, first rewrite both with a common denominator.',
    'Same bottom number: add the top numbers only. Different bottoms: make them match first.',
    [
      ['1/5 + 2/5 = ?', ['3/5', '3/10', '2/5', '1/5'], 0],
      ['3/8 + 2/8 = ?', ['5/16', '5/8', '1/8', '6/8'], 1],
      ['1/2 + 1/4 = ?', ['2/6', '2/4', '3/4', '1/6'], 2],
      ['2/3 + 1/6 = ?', ['3/9', '5/6', '3/6', '2/9'], 1],
      ['4/9 + 3/9 = ?', ['7/18', '1/9', '7/9', '12/9'], 2],
      ['1/3 + 1/3 + 1/3 = ?', ['3/9', '1', '1/9', '3'], 1],
      ['Maria ate 1/4 of a pizza and Ben ate 2/4. How much did they eat together?', ['3/8', '1/4', '2/4', '3/4'], 3],
      ['1/2 + 1/3 = ?', ['2/5', '5/6', '1/5', '2/6'], 1],
    ]),
  lesson('math5', 'decimals', 'Decimal place value', 'math5.decimals.place-value',
    'In a decimal, each place to the right of the point is ten times smaller. The first place is tenths, the second is hundredths, the third is thousandths. In 3.47, the 4 means 4 tenths.',
    'Read the places after the point as tenths, then hundredths, then thousandths.',
    [
      ['In 3.47, what is the value of the digit 4?', ['4 ones', '4 tenths', '4 hundredths', '4 tens'], 1],
      ['In 6.28, what is the value of the digit 8?', ['8 tenths', '8 hundredths', '8 ones', '8 thousandths'], 1],
      ['Which decimal is the same as 3/10?', ['0.03', '0.3', '3.0', '0.13'], 1],
      ['Which decimal is the same as 7/100?', ['0.7', '0.07', '7.0', '0.007'], 1],
      ['Which is greater?', ['0.5', '0.45', '0.405', '0.05'], 0],
      ['Which is the smallest?', ['0.9', '0.19', '0.09', '0.91'], 2],
      ['0.25 is the same as how many hundredths?', ['2', '5', '25', '250'], 2],
      ['Which number is 2 ones, 0 tenths and 5 hundredths?', ['2.5', '2.05', '2.005', '25.0'], 1],
    ]),
]);

const english = pack('eng5', 'ENGLISH', 'Reading Comprehension', ['eng5.reading.main-idea'], [
  lesson('eng5', 'main-idea', 'Finding the main idea', 'eng5.reading.main-idea',
    'The main idea is what a passage is mostly about. Details support the main idea. Ask yourself: what is the one big point the writer wants me to remember?',
    'The main idea covers the whole passage, not just one sentence.',
    [
      ['Ana waters the plants, feeds the hens and sweeps the yard every morning. What is the main idea?', ['Ana has hens', 'Ana does chores at home', 'Ana likes plants', 'Mornings are cool'], 1],
      ['What do the details in a passage do?', ['Support the main idea', 'Replace the title', 'End the story', 'Ask a question'], 0],
      ['Which is the best title for a passage about how bees make honey?', ['Busy Bees at Work', 'My Garden', 'A Rainy Day', 'Sweet Fruits'], 0],
    ]),
]);

const filipino = pack('fil5', 'FILIPINO', 'Panitikan at Balarila', ['fil5.balarila.pangngalan'], [
  lesson('fil5', 'pangngalan', 'Ang pangngalan', 'fil5.balarila.pangngalan',
    'Ang pangngalan ay salitang tumutukoy sa tao, hayop, bagay, lugar o pangyayari. Halimbawa: guro, aso, lapis, paaralan, pista.',
    'Itanong: ito ba ay pangalan ng tao, hayop, bagay, lugar o pangyayari?',
    [
      ['Alin ang pangngalan?', ['tumakbo', 'mabilis', 'paaralan', 'masaya'], 2],
      ['Alin ang pangngalang tumutukoy sa hayop?', ['kalabaw', 'upuan', 'Maynila', 'guro'], 0],
      ['Alin ang pangngalang tumutukoy sa lugar?', ['lapis', 'palengke', 'kumain', 'maganda'], 1],
    ]),
]);

const science = pack('sci5', 'SCIENCE', 'Life Cycles & Ecosystems', ['sci5.life-cycles.butterfly'], [
  lesson('sci5', 'butterfly', 'Life cycle of a butterfly', 'sci5.life-cycles.butterfly',
    'A butterfly changes form as it grows. This is called complete metamorphosis. The stages are egg, larva (caterpillar), pupa (chrysalis) and adult butterfly.',
    'Remember the order: egg, larva, pupa, adult.',
    [
      ['What is the first stage of a butterfly life cycle?', ['Pupa', 'Egg', 'Adult', 'Larva'], 1],
      ['What is a caterpillar?', ['An egg', 'A pupa', 'A larva', 'An adult'], 2],
      ['Which stage comes right before the adult butterfly?', ['Egg', 'Larva', 'Pupa', 'Seed'], 2],
    ]),
]);

export const starterPacks: Pack[] = [math, english, filipino, science];
