const fs = require('fs');
const path = require('path');

// I'll create the schema for firebase-blueprint.json
const schema = {
  entities: {
    profiles: {
      type: "object",
      properties: {
        username: { type: "string" },
        display_name: { type: "string" },
        avatar_url: { type: "string" },
        cover_url: { type: "string" },
        bio: { type: "string" },
        created_at: { type: "string" },
        updated_at: { type: "string" }
      }
    },
    posts: {
       type: "object",
       properties: {
         user_id: { type: "string" },
         content: { type: "string" },
         media_url: { type: "string" },
         media_type: { type: "string" },
         created_at: { type: "string" }
       }
    },
    comments: {
       type: "object",
       properties: {
         post_id: { type: "string" },
         user_id: { type: "string" },
         content: { type: "string" },
         created_at: { type: "string" }
       }
    },
    likes: {
       type: "object",
       properties: {
         post_id: { type: "string" },
         user_id: { type: "string" },
         created_at: { type: "string" }
       }
    },
    reels: {
       type: "object"
    },
    messages: {
       type: "object"
    },
    friendships: {
       type: "object"
    },
    notifications: {
       type: "object"
    }
  },
  firestore: {
    "profiles/{id}": { schema: "profiles", description: "Users" },
    "posts/{id}": { schema: "posts", description: "Posts" },
    "comments/{id}": { schema: "comments", description: "Comments" },
    "likes/{id}": { schema: "likes", description: "Likes" },
    "reels/{id}": { schema: "reels", description: "Reels" },
    "messages/{id}": { schema: "messages", description: "Messages" },
    "friendships/{id}": { schema: "friendships", description: "Friendships" },
    "notifications/{id}": { schema: "notifications", description: "Notifications" }
  }
};
fs.writeFileSync('firebase-blueprint.json', JSON.stringify(schema, null, 2));
console.log('firebase-blueprint.json created');
