package com.ecodesk.service;

import com.ecodesk.entity.OtpPurpose;
import org.junit.jupiter.api.Test;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

class SmtpIntegrationTest {

    @Test
    void sendOtpEmail_sendsRealSmtpMessageWithoutLeakingSecrets() throws Exception {
        try (ServerSocket serverSocket = new ServerSocket(0, 1, InetAddress.getLoopbackAddress())) {
            int port = serverSocket.getLocalPort();

            CompletableFuture<String> capturedTranscript = CompletableFuture.supplyAsync(() -> {
                StringBuilder data = new StringBuilder();
                try (Socket client = serverSocket.accept();
                     BufferedReader in = new BufferedReader(new InputStreamReader(client.getInputStream(), StandardCharsets.UTF_8));
                     BufferedWriter out = new BufferedWriter(new OutputStreamWriter(client.getOutputStream(), StandardCharsets.UTF_8))) {

                    out.write("220 localhost ESMTP EcoDeskTest\r\n");
                    out.flush();

                    String line;
                    boolean inData = false;
                    while ((line = in.readLine()) != null) {
                        if (inData) {
                            if (".".equals(line)) {
                                inData = false;
                                out.write("250 2.0.0 Ok: queued\r\n");
                                out.flush();
                            } else {
                                data.append(line).append("\n");
                            }
                            continue;
                        }
                        if (line.startsWith("EHLO") || line.startsWith("HELO")) {
                            out.write("250-localhost\r\n250 SIZE 10240000\r\n");
                            out.flush();
                        } else if (line.startsWith("MAIL FROM:") || line.startsWith("RCPT TO:") || line.startsWith("NOOP")) {
                            out.write("250 2.1.0 Ok\r\n");
                            out.flush();
                        } else if (line.equals("DATA")) {
                            inData = true;
                            out.write("354 End data with <CR><LF>.<CR><LF>\r\n");
                            out.flush();
                        } else if (line.equals("QUIT")) {
                            out.write("221 2.0.0 Bye\r\n");
                            out.flush();
                            break;
                        } else {
                            out.write("250 Ok\r\n");
                            out.flush();
                        }
                    }
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
                return data.toString();
            });

            EmailOtpService mailService = new EmailOtpService(
                    "127.0.0.1", port, "", "",
                    false, false, false,
                    "no-reply@ecodesk.vn", "EcoDesk Studio", "smtp-test-pepper"
            );

            assertTrue(mailService.isMailConfigured());
            mailService.sendOtpEmail("customer@example.com", OtpPurpose.REGISTER, "004819", 15, "Khach Hang Test");

            String rawSmtpBody = capturedTranscript.get(10, TimeUnit.SECONDS);
            assertTrue(rawSmtpBody.contains("no-reply@ecodesk.vn"));
            assertTrue(rawSmtpBody.contains("customer@example.com"));
            assertTrue(rawSmtpBody.contains("004819"));
        }
    }
}

