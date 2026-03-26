import {
  allNumericInSameTriplet,
  evaluateRound12,
  evaluateRound3,
  isAllowedCard,
  parseVote,
} from './poker-rules';

describe('poker-rules', () => {
  it('parseVote', () => {
    expect(parseVote('5')).toBe(5);
    expect(parseVote('?')).toBe('?');
    expect(parseVote('99')).toBeNull();
  });

  it('isAllowedCard', () => {
    expect(isAllowedCard('13')).toBe(true);
    expect(isAllowedCard('4')).toBe(false);
  });

  it('allNumericInSameTriplet', () => {
    expect(allNumericInSameTriplet([2, 3, 3])).toBe(true);
    expect(allNumericInSameTriplet([3, 5, 8])).toBe(true);
    expect(allNumericInSameTriplet([2, 8])).toBe(false);
  });

  it('evaluateRound12 success / failure / ?', () => {
    expect(evaluateRound12(['3', '3', '5'])).toEqual({
      kind: 'success',
      average: (3 + 3 + 5) / 3,
    });
    expect(evaluateRound12(['2', '8'])).toMatchObject({ kind: 'failure', min: 2, max: 8 });
    expect(evaluateRound12(['5', '?'])).toEqual({ kind: 'cannot_estimate' });
  });

  it('evaluateRound3 convergence', () => {
    expect(evaluateRound3(['3', '5', '8', '8', '1'])).toMatchObject({
      kind: 'converged',
      average: 4,
      remaining: [3, 5],
    });
    expect(evaluateRound3(['5', '5', '5'])).toEqual({ kind: 'cannot_estimate' });
    expect(evaluateRound3(['5', '?'])).toEqual({ kind: 'cannot_estimate' });
  });
});
