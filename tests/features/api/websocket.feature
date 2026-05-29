@websocket @regression
Feature: WebSocket echo validation
  As a messaging system validator
  I want to open a WebSocket connection and receive echoes

  Scenario: Send a message and receive an echo
    Given I connect to the echo WebSocket
    When I send the WebSocket message "hello world"
    Then I should receive an echoed WebSocket message containing "hello world"
