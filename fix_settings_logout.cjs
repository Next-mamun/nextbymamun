const fs = require('fs');
let content = fs.readFileSync('src/pages/Settings.tsx', 'utf8');

const replacement = `                <SettingRow field="email" label="Email Address" type="email" currentValue={profile?.email || ''} />
                <SettingRow field="password" label="Password" type="password" currentValue="••••••••" isPassword />
              </Section>
              
              <Section title="Account Actions">
                <div className="flex flex-col gap-3 p-4">
                  <button 
                    onClick={() => {
                      const { logout } = require('@/contexts/AuthContext').useAuth();
                      if(window.confirm('Add or Switch Account? You will be logged out to sign in with a different account. All cache will be cleared.')) {
                        logout();
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <UserPlus size={18} /> Add / Switch Account
                  </button>
                  <button 
                    onClick={() => {
                      const { logout } = require('@/contexts/AuthContext').useAuth();
                      logout();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 font-bold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                  >
                    <LogOut size={18} /> Logout
                  </button>
                </div>
              </Section>
            </div>`;

content = content.replace(
  /                <SettingRow field="email" label="Email Address" type="email" currentValue=\{profile\?\.email \|\| ''\} \/>\n                <SettingRow field="password" label="Password" type="password" currentValue="••••••••" isPassword \/>\n              <\/Section>\n            <\/div>/g,
  replacement
);

if (!content.includes('LogOut')) {
  content = content.replace(/import \{ Monitor, /g, "import { Monitor, LogOut, UserPlus, ");
}

fs.writeFileSync('src/pages/Settings.tsx', content);
console.log('Fixed settings logout');
