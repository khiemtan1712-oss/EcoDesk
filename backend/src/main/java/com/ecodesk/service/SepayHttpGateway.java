package com.ecodesk.service;

import java.util.Map;

/**
 * HTTP abstraction for calling SePay APIs cleanly and deterministically in tests.
 */
public interface SepayHttpGateway {

    SepayHttpResponse get(String url, String bearerToken);

    record SepayHttpResponse(
            int statusCode,
            String body,
            Map<String, String> headers
    ) {
        public String headerIgnoreCase(String name) {
            if (headers == null || name == null) return null;
            for (Map.Entry<String, String> entry : headers.entrySet()) {
                if (name.equalsIgnoreCase(entry.getKey())) {
                    return entry.getValue();
                }
            }
            return null;
        }
    }
}

