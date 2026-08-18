import { RemoteCommandState } from '@prisma/client';

import {
  ALLOWED_TRANSITIONS,
  assertRemoteCommandTransitionAllowed,
  canTransitionRemoteCommand,
  NON_TERMINAL_REMOTE_COMMAND_STATES,
  TERMINAL_REMOTE_COMMAND_STATES,
} from './remote-command-state-machine';
import { InvalidRemoteCommandTransitionError } from './remote-command.errors';

describe('RemoteCommand state machine (WO-ARGOS-059)', () => {
  describe('valid transitions', () => {
    it.each([
      [RemoteCommandState.REQUESTED, RemoteCommandState.SENT],
      [RemoteCommandState.REQUESTED, RemoteCommandState.REJECTED],
      [RemoteCommandState.SENT, RemoteCommandState.ACCEPTED],
      [RemoteCommandState.SENT, RemoteCommandState.REJECTED],
      [RemoteCommandState.SENT, RemoteCommandState.TIMED_OUT],
      [RemoteCommandState.ACCEPTED, RemoteCommandState.CONFIRMED],
      [RemoteCommandState.ACCEPTED, RemoteCommandState.UNCONFIRMED],
    ])('%s -> %s is allowed', (from, to) => {
      expect(canTransitionRemoteCommand(from, to)).toBe(true);
      expect(() =>
        assertRemoteCommandTransitionAllowed(from, to),
      ).not.toThrow();
    });
  });

  describe('invalid transitions fail rather than silently overwrite state', () => {
    it.each([
      [RemoteCommandState.REQUESTED, RemoteCommandState.ACCEPTED],
      [RemoteCommandState.REQUESTED, RemoteCommandState.CONFIRMED],
      [RemoteCommandState.SENT, RemoteCommandState.REQUESTED],
      [RemoteCommandState.SENT, RemoteCommandState.CONFIRMED],
      [RemoteCommandState.ACCEPTED, RemoteCommandState.SENT],
      [RemoteCommandState.ACCEPTED, RemoteCommandState.REJECTED],
      [RemoteCommandState.ACCEPTED, RemoteCommandState.TIMED_OUT],
    ])('%s -> %s is rejected', (from, to) => {
      expect(canTransitionRemoteCommand(from, to)).toBe(false);
      expect(() => assertRemoteCommandTransitionAllowed(from, to)).toThrow(
        InvalidRemoteCommandTransitionError,
      );
    });
  });

  describe('terminal states', () => {
    it.each([...TERMINAL_REMOTE_COMMAND_STATES])(
      '%s has no outgoing transitions — a command cannot resolve twice',
      (state) => {
        expect(ALLOWED_TRANSITIONS[state]).toEqual([]);
      },
    );

    it('REJECTED/TIMED_OUT/CONFIRMED/UNCONFIRMED are exactly the terminal set', () => {
      expect([...TERMINAL_REMOTE_COMMAND_STATES].sort()).toEqual(
        [
          RemoteCommandState.REJECTED,
          RemoteCommandState.TIMED_OUT,
          RemoteCommandState.CONFIRMED,
          RemoteCommandState.UNCONFIRMED,
        ].sort(),
      );
    });
  });

  describe('non-terminal states (concurrency-guard scope)', () => {
    it('REQUESTED/SENT/ACCEPTED are exactly the non-terminal set', () => {
      expect([...NON_TERMINAL_REMOTE_COMMAND_STATES].sort()).toEqual(
        [
          RemoteCommandState.REQUESTED,
          RemoteCommandState.SENT,
          RemoteCommandState.ACCEPTED,
        ].sort(),
      );
    });
  });

  it('every RemoteCommandState enum value is covered by the transition table', () => {
    const enumValues = Object.values(RemoteCommandState);
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual(
      [...enumValues].sort(),
    );
  });
});
