const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { buildSchema } = require('graphql');

const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

class DownstreamError extends Error {
  constructor(message, errorCode) {
    super(message);
    this.name = 'DownstreamError';
    this.code = errorCode;
  }
}

// API
const BASE_URI = 'https://jsonplaceholder.typicode.com/posts';

// Construct a schema, using GraphQL schema language
const schema = buildSchema(`
  type Query {
    getPosts: [Post]
    getPostById(id: ID!): GetPostResponse
  }
  type Mutation {
    createPost(title: String!, body: String!, userId: ID!): CreatePostResponse
  }
  type Post {
    id: ID!
    title: String!
    body: String!
    userId: ID!
  }
  type NotCreated implements PostError {
    message: String!
    code: String!
  }
  type NotFound implements PostError {
    message: String!
    code: String!
  }
  type UnknownError implements PostError {
    message: String!
    code: String!
  }
  interface PostError {
    message: String!
    code: String!
  }

  union CreatePostResponse = Post | NotCreated
  union GetPostResponse = Post | NotFound | UnknownError
`);

const getPosts = async () => {
  return await fetch(BASE_URI).then((response) => response.json());
};

const getPostById = async ({ id }) => {
  try {
    const post = await fetch(`${BASE_URI}/${id}`).then((response) => {
      if (!response.ok) {
        throw new DownstreamError('API error', response.status);
      }
      return response.json();
    });
    return {
      __typename: 'Post',
      ...post,
    };
  } catch (e) {
    if (e instanceof DownstreamError) {
      if (e.code === 404) {
        return {
          __typename: 'NotFound',
          message: 'Post not found!!!!!!!',
          code: e.code,
        };
      }
    }
    return {
      __typename: 'UnknownError',
      message: e.message,
      code: e.code,
    };
  }
};

const createPost = async (input) => {
  const post = await fetch(BASE_URI, {
    method: 'POST',
    body: JSON.stringify(input),
    headers: {
      'Content-type': 'application/json; charset=UTF-8',
    },
  }).then((response) => response.json());

  if (!post) {
    return {
      __typename: 'PostError',
      message: 'Post could not be created',
      code: '1000',
    };
  }
  return {
    __typename: 'Post',
    ...post,
  };
};

// The root provides a resolver function for each API endpoint
const root = {
  getPosts,
  getPostById,
  createPost,
};

const app = express();

app.use(
  '/',
  graphqlHTTP({
    schema: schema,
    rootValue: root,
    graphiql: true,
  })
);

app.listen(4000, () =>
  console.log('Running a GraphQL API server at http://localhost:4000/')
);
