const fs = require('fs');
const filePath = 'apps/web/app/label/page.tsx';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add import
if (!code.includes('DaysOfWeekPanel')) {
  code = code.replace(
    "import { ReasonsPanel } from './ReasonsPanel';", 
    "import { ReasonsPanel } from './ReasonsPanel';\nimport { DaysOfWeekPanel } from './DaysOfWeekPanel';"
  );
}

// 2. Inject DaysOfWeekPanel in left column
code = code.replace(
  '{numberPad.visible ? (',
  '{activeControl === \\\'days_of_week\\\' ? (\n            <DaysOfWeekPanel />\n          ) : numberPad.visible ? ('
);

// 3. Update the Name of Days button
const oldButtonLogic = `
          {/* NAME OF DAYS CONTROL */}
          <button 
            disabled={isStatActive}
            onClick={() => openNumberPad('days')}
            className={\`h-16 shrink-0 border-2 rounded-xl flex items-center justify-center text-2xl font-bold shadow-sm transition-colors \${
              isStatActive ? 'opacity-50 pointer-events-none' : ''
            } \${
              useLabelStore.getState().days !== null && useLabelStore.getState().days! > 0
                ? 'bg-blue-100 text-[#1F48FF] border-[#1F48FF]'
                : 'bg-white text-gray-600 border-gray-300 active:bg-gray-100'
            }\`}
          >
            {useLabelStore.getState().days !== null && useLabelStore.getState().days! > 0 
              ? \`DAYS: \${useLabelStore.getState().days}\` 
              : 'Name of Days Placeholder'
            }
          </button>
`;

const newButtonLogic = `
          {/* NAME OF DAYS CONTROL */}
          <button 
            disabled={isStatActive}
            onClick={() => useLabelStore.getState().openDaysOfWeekPanel()}
            className={\`h-16 shrink-0 border-2 rounded-xl flex flex-wrap gap-1 px-2 overflow-hidden items-center justify-center text-lg font-bold shadow-sm transition-colors \${
              isStatActive ? 'opacity-50 pointer-events-none' : ''
            } \${
              useLabelStore.getState().selectedDaysOfWeek.length > 0
                ? 'bg-blue-100 text-[#1F48FF] border-[#1F48FF]'
                : 'bg-white text-gray-600 border-gray-300 active:bg-gray-100'
            }\`}
          >
            {useLabelStore.getState().selectedDaysOfWeek.length > 0
              ? useLabelStore.getState().selectedDaysOfWeek.join(', ') 
              : 'Name of Days Placeholder'
            }
          </button>
`;

// Just search for the start and end of that button and replace it
const btnStart = code.indexOf('{/* NAME OF DAYS CONTROL */}');
const btnEnd = code.indexOf('</button>', btnStart) + '</button>'.length;

if (btnStart !== -1 && btnEnd !== -1) {
  const oldBtnChunk = code.substring(btnStart, btnEnd);
  code = code.replace(oldBtnChunk, newButtonLogic.trim());
}

fs.writeFileSync(filePath, code);
console.log('Replaced');
