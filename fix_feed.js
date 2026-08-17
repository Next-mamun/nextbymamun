import fs from 'fs';
let code = fs.readFileSync('src/pages/Feed.tsx', 'utf8');

code = code.replace(
  /\{postsError \? \([\s\S]*?\) : postsLoading && posts\.length === 0 \? \(/g,
  \`{postsError && posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
          <p className="font-bold text-red-500">Error loading posts: {postsError.message || "Quota exceeded"}</p>
          <button type="button" onClick={() => window.location.reload()} className="bg-[#1877F2] text-white px-4 py-2 rounded-lg font-bold">Retry</button>
        </div>
      ) : postsLoading && posts.length === 0 ? (\`
);

fs.writeFileSync('src/pages/Feed.tsx', code);
