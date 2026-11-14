package com.openbox.ai;

import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

// Job: a fake store that accepts TCP connections and never answers, so a driver hangs on it.
final class HangingStore implements AutoCloseable {

  private final ServerSocket server;
  private final List<Socket> held = new CopyOnWriteArrayList<>();

  HangingStore() {
    try {
      server = new ServerSocket(0, 50, InetAddress.getLoopbackAddress());
    } catch (IOException e) {
      throw new IllegalStateException(e);
    }
    Thread.ofPlatform().daemon().name("hanging-store").start(this::acceptForever);
  }

  int port() {
    return server.getLocalPort();
  }

  private void acceptForever() {
    while (!server.isClosed()) {
      try {
        held.add(server.accept());
      } catch (IOException closed) {
        return;
      }
    }
  }

  @Override
  public void close() throws IOException {
    server.close();
    for (Socket socket : held) {
      socket.close();
    }
  }
}
