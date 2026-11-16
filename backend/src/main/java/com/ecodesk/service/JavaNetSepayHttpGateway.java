package com.ecodesk.service;

import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class JavaNetSepayHttpGateway implements SepayHttpGateway {

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Override
    public SepayHttpResponse get(String url, String bearerToken) {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(15))
                .header("Accept", "application/json")
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + bearerToken)
                .GET()
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            Map<String, String> flatHeaders = new LinkedHashMap<>();
            for (Map.Entry<String, List<String>> entry : response.headers().map().entrySet()) {
                if (entry.getValue() != null && !entry.getValue().isEmpty()) {
                    flatHeaders.put(entry.getKey(), entry.getValue().get(0));
                }
            }
            return new SepayHttpResponse(response.statusCode(), response.body(), flatHeaders);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Yeu cau ket noi SePay bi gian doan.", ex);
        } catch (IOException ex) {
            throw new IllegalStateException("Khong the ket noi SePay API: " + ex.getMessage(), ex);
        }
    }
}

