@api @smoke
Feature: Users API validation
  As an API consumer
  I want to query user information
  So that the Users API returns valid user details

  Scenario: Get a user by id
    Given I request user details for id "1"
    Then the user response status should be 200
    And the user response should contain a username
