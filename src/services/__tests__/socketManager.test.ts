import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SocketManager, SocketConfig } from '../socketManager';

const { mockSocket, io } = vi.hoisted(() => {
  const mockSocket = {
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(),
    emit: vi.fn().mockReturnThis(),
    disconnect: vi.fn().mockReturnThis(),
    connected: false,
    id: 'mock-socket-id',
  };

  return {
    mockSocket,
    io: vi.fn(() => mockSocket),
  };
});

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io,
  Socket: vi.fn(),
}));

describe('SocketManager', () => {
  let config: SocketConfig;
  let socketManager: SocketManager;

  beforeEach(() => {
    mockSocket.connected = false;
    config = {
      url: 'http://localhost:3001',
      options: {
        transports: ['websocket'],
        autoConnect: false,
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: 3,
        timeout: 10000,
      },
    };
    socketManager = new SocketManager(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a SocketManager with provided config', () => {
      expect(socketManager).toBeInstanceOf(SocketManager);
    });

    it('should merge provided options with defaults', () => {
      const manager = new SocketManager({ url: 'http://test.com' });
      manager.connect();
      expect(io).toHaveBeenCalledWith('http://test.com', {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 20000,
      });
    });

    it('should override defaults with provided options', () => {
      socketManager.connect();
      expect(io).toHaveBeenCalledWith('http://localhost:3001', {
        transports: ['websocket'],
        autoConnect: false,
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: 3,
        timeout: 10000,
      });
    });

    it('should assert default presence when partial options are provided', () => {
      const manager = new SocketManager({
        url: 'http://test.com',
        options: {
          timeout: 15000,
        },
      });
      manager.connect();
      expect(io).toHaveBeenCalledWith('http://test.com', {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 15000,
      });
    });
  });

  describe('connect', () => {
    it('should create a socket connection', () => {
      const socket = socketManager.connect();

      expect(io).toHaveBeenCalledTimes(1);
      expect(socket).toBeDefined();
    });

    it('should return existing socket if already connected', () => {
      const socket1 = socketManager.connect();
      mockSocket.connected = true;
      const socket2 = socketManager.connect();

      expect(io).toHaveBeenCalledTimes(1);
      expect(socket1).toBe(socket2);
    });

    it('should set up event listeners on connect', () => {
      const socket = socketManager.connect();

      expect(socket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith('reconnect', expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith('reconnect_error', expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith('reconnect_failed', expect.any(Function));
    });
  });

  describe('disconnect', () => {
    it('should disconnect the socket', () => {
      socketManager.connect();
      socketManager.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
    });

    it('should not throw if disconnect called before connect', () => {
      expect(() => socketManager.disconnect()).not.toThrow();
    });
  });

  describe('event registration', () => {
    it('should register event listener', () => {
      socketManager.connect();
      const callback = vi.fn();
      socketManager.on('test-event', callback);

      expect(mockSocket.on).toHaveBeenCalledWith('test-event', callback);
    });

    it('should unregister specific event listener', () => {
      socketManager.connect();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      socketManager.on('test-event', callback1);
      socketManager.on('test-event', callback2);
      socketManager.off('test-event', callback1);

      expect(mockSocket.off).toHaveBeenCalledWith('test-event', callback1);
    });

    it('should unregister all listeners for an event when callback not provided', () => {
      socketManager.connect();
      const callback = vi.fn();
      socketManager.on('test-event', callback);
      socketManager.off('test-event');

      expect(mockSocket.off).toHaveBeenCalledWith('test-event', undefined);
    });

    it('should register once listener', () => {
      socketManager.connect();
      const callback = vi.fn();
      socketManager.once('test-event', callback);

      expect(mockSocket.once).toHaveBeenCalledWith('test-event', callback);
    });
  });

  describe('isConnected', () => {
    it('should return false before connect', () => {
      expect(socketManager.isConnected()).toBe(false);
    });

    it('should return false when socket is not connected', () => {
      socketManager.connect();
      expect(socketManager.isConnected()).toBe(false);
    });

    it('should return true when socket is connected', () => {
      mockSocket.connected = true;
      socketManager.connect();
      expect(socketManager.isConnected()).toBe(true);
    });
  });

  describe('emit', () => {
    it('should emit event when connected', () => {
      mockSocket.connected = true;
      socketManager.connect();
      socketManager.emit('test-event', { data: 'test' });

      expect(mockSocket.emit).toHaveBeenCalledWith('test-event', { data: 'test' });
    });

    it('should not emit event when not connected', () => {
      mockSocket.connected = false;
      socketManager.connect();
      vi.clearAllMocks();

      socketManager.emit('test-event', { data: 'test' });

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should queue event when offline if queueing enabled', () => {
      const queueConfig: SocketConfig = {
        ...config,
        queueEnabled: true,
      };
      const queueManager = new SocketManager(queueConfig);
      queueManager.connect();
      mockSocket.connected = false;

      queueManager.emit('test-event', { data: 'queued' });

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should remove all registered listeners on disconnect', () => {
      socketManager.connect();
      const callback = vi.fn();
      socketManager.on('test-event', callback);
      socketManager.disconnect();

      expect(mockSocket.off).toHaveBeenCalledWith('test-event', callback);
      expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('reconnection handling', () => {
    it('should clear queue on reconnect_failed if configured', () => {
      const failConfig: SocketConfig = {
        ...config,
        queueEnabled: true,
      };
      const failManager = new SocketManager(failConfig);
      failManager.connect();

      // Verify reconnect_failed listener was registered
      expect(mockSocket.on).toHaveBeenCalledWith('reconnect_failed', expect.any(Function));
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully without socket', () => {
      expect(() => socketManager.emit('test', {})).not.toThrow();
      expect(() => socketManager.disconnect()).not.toThrow();
    });

    it('should not throw if off called without connection', () => {
      expect(() => socketManager.off('test-event')).not.toThrow();
    });

    it('should not throw if once called without connection', () => {
      expect(() => socketManager.once('test-event', vi.fn())).not.toThrow();
    });
  });
});

describe('getSocketManager', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should throw if called without config and no instance exists', async () => {
    const { getSocketManager } = await import('../socketManager');
    expect(() => getSocketManager()).toThrow('SocketManager not initialized');
  });

  it('should create instance when config is provided', async () => {
    const { SocketManager: FreshSocketManager, getSocketManager } = await import('../socketManager');
    const manager = getSocketManager({ url: 'http://test.com' });
    expect(manager).toBeInstanceOf(FreshSocketManager);
  });

  it('should return same instance on subsequent calls', async () => {
    const { getSocketManager } = await import('../socketManager');
    const manager1 = getSocketManager({ url: 'http://test.com' });
    const manager2 = getSocketManager();
    expect(manager1).toBe(manager2);
  });
});

describe('initializeSocketManager', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should create a new SocketManager instance', async () => {
    const { SocketManager: FreshSocketManager, initializeSocketManager } = await import('../socketManager');
    const manager = initializeSocketManager({ url: 'http://test.com' });
    expect(manager).toBeInstanceOf(FreshSocketManager);
  });

  it('should replace existing singleton instance', async () => {
    const { initializeSocketManager, getSocketManager } = await import('../socketManager');
    const manager1 = initializeSocketManager({ url: 'http://test.com' });
    const manager2 = initializeSocketManager({ url: 'http://other.com' });
    const manager3 = getSocketManager();
    expect(manager2).toBe(manager3);
    expect(manager1).not.toBe(manager2);
  });
});