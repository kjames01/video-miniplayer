// Mock koffi for unit tests — Win32 APIs can't be called in test environment

const mockFunc = jest.fn().mockReturnValue(jest.fn().mockReturnValue(true));

export default {
  load: jest.fn().mockReturnValue({
    func: mockFunc,
  }),
  struct: jest.fn().mockReturnValue({}),
  pointer: jest.fn().mockReturnValue({}),
  proto: jest.fn().mockReturnValue({}),
  register: jest.fn().mockReturnValue(jest.fn()),
  unregister: jest.fn(),
  opaque: jest.fn().mockReturnValue({}),
  array: jest.fn().mockReturnValue({}),
  out: jest.fn().mockReturnValue({}),
};
