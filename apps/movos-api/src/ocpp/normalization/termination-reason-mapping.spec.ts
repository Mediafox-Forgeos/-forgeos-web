import { mapStopReasonToTerminationReason } from './termination-reason-mapping';

describe('mapStopReasonToTerminationReason', () => {
  it.each([
    [undefined, 'NORMAL_COMPLETION'],
    ['Local', 'USER_CANCELLED'],
    ['EmergencyStop', 'EMERGENCY_STOP'],
    ['EVDisconnected', 'CABLE_DISCONNECTED'],
    ['HardReset', 'STATION_REBOOT'],
    ['Reboot', 'STATION_REBOOT'],
    ['SoftReset', 'STATION_REBOOT'],
    ['PowerLoss', 'POWER_LOSS'],
    ['Remote', 'REMOTE_STOP'],
    ['UnlockCommand', 'USER_CANCELLED'],
    ['Other', 'UNKNOWN'],
    ['DeAuthorized', 'UNKNOWN'],
    ['SomeFutureReasonNotYetInTheSpec', 'UNKNOWN'],
  ] as const)('maps %s to %s', (reason, expected) => {
    expect(mapStopReasonToTerminationReason(reason)).toBe(expected);
  });
});
