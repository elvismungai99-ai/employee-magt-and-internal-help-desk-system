package com.leavemgt.platform.handler;

import com.leavemgt.platform.entity.EventOutbox;

public interface DomainEventHandler {

    boolean canHandle(String eventType);

    void handle(EventOutbox event) throws Exception;
}
