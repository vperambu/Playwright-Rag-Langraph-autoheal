@ui @regression @requires-auth
Feature: Login flow validation
  In order to validate a simulated auth flow
  As a test automation engineer
  I want to access a login-like page and confirm it loads

  Scenario: Open login page and verify introduction content
    Given I open the login page
    Then the login page should be available
    When I perform a login attempt with valid credentials
    Then the dashboard page should be loaded
