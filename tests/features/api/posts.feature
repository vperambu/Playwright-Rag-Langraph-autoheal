@api @regression
Feature: Posts API validation
  As an API consumer
  I want to query and manage posts
  So that the Posts API responds correctly

  Scenario: Get the list of posts
    Given I request the list of posts
    Then the posts response status should be 200
    And the posts response should include at least 1 record

  Scenario: Create and delete a post
    Given I create a new post with title "Hello" and body "World" for user "1"
    Then the created post response status should be 201
    When I delete the post
    Then the delete post response status should be 200
