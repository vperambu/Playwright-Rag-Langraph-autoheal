@ui @smoke
Feature: Home page navigation
  As a user
  I want to open the Playwright home page
  So that I can verify the home page is displayed correctly

  Scenario: Open the Playwright home page
    Given I open the home page
    Then I should see the hero title on the home page
    When I click the Get Started link
    Then I should navigate to the documentation intro page
