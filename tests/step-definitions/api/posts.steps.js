const { Given, When, Then } = require('@cucumber/cucumber');
const { expectOk, expectStatus } = require('../../utils/assertion.util');

Given('I request the list of posts', async function () {
  await this.initApi();
  this.testData.postsResponse = await this.getClient('posts').getPosts();
});

Then('the posts response status should be {int}', async function (expectedStatus) {
  expectStatus(this.testData.postsResponse, expectedStatus);
});

Then('the posts response should include at least 1 record', async function () {
  const body = await this.testData.postsResponse.json();
  if (!Array.isArray(body) || body.length < 1) throw new Error('Expected at least one post record');
});

Given('I create a new post with title {string} and body {string} for user {string}', async function (title, body, userId) {
  await this.initApi();
  const response = await this.getClient('posts').createPost({ title, body, userId: Number(userId) });
  this.testData.createdPostResponse = response;
  this.testData.createdPost = await response.json();
});

Then('the created post response status should be {int}', async function (expectedStatus) {
  expectStatus(this.testData.createdPostResponse, expectedStatus);
});

When('I delete the post', async function () {
  const post = this.testData.createdPost;
  if (!post || !post.id) throw new Error('No post available for deletion');
  this.testData.deleteResponse = await this.getClient('posts').deletePost(post.id);
});

Then('the delete post response status should be {int}', async function (expectedStatus) {
  expectStatus(this.testData.deleteResponse, expectedStatus);
});
