const fs = require('fs');
const filePath = 'apps/web/app/label/page.tsx';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add import
if (!code.includes('ReasonsPanel')) {
  code = code.replace("import { StatFollowUpPanel } from '../../components/StatFollowUpPanel';", "import { StatFollowUpPanel } from '../../components/StatFollowUpPanel';\nimport { ReasonsPanel } from './ReasonsPanel';");
}

// 2. Wrap Dosage Rows
const dosageStart = code.indexOf("{(['morning', 'lunch', 'night'] as const).map((time) => {");
const dosageEndComment = code.indexOf("{/* ACTION BUTTONS GRID */}");
if (dosageStart !== -1 && dosageEndComment !== -1) {
  const replacement = `
          {useLabelStore.getState().additionalInstructions.includes('REASONS') ? (
            <ReasonsPanel />
          ) : (
            <>
              {(['morning', 'lunch', 'night'] as const).map((time) => {
                const timeUpper = time.toUpperCase();
                const currentQty = dosage[time].qty;
                const currentIsFrac = dosage[time].isFraction;
                
                // Format fraction display beautifully
                let displayQty = currentQty.toString();
                if (currentIsFrac) {
                  const whole = Math.floor(currentQty);
                  const frac = currentQty - whole;
                  let fracStr = '';
                  if (Math.abs(frac - 0.5) < 0.01) fracStr = '½';
                  else if (Math.abs(frac - 0.25) < 0.01) fracStr = '¼';
                  else if (Math.abs(frac - 0.75) < 0.01) fracStr = '¾';
                  else fracStr = frac > 0 ? \` \${frac.toFixed(2).replace('0.', '.')}\` : '';

                  if (whole === 0) displayQty = fracStr || '0';
                  else displayQty = \`\${whole}\${fracStr}\`;
                }

                const isActive = useLabelStore.getState().activeControl === time;

                return (
                  <div 
                    key={timeUpper} 
                    onClick={() => {
                      if (activeControl === 'stat_followup') {
                        setStatFollowUp(timeUpper);
                      } else {
                        setActiveControl(time);
                      }
                    }}
                    className={\`flex-1 border-2 rounded-2xl p-6 flex items-center justify-between shadow-sm cursor-pointer transition-colors \${
                      isActive ? 'bg-[#1F48FF]/10 border-[#1F48FF]' : 'bg-white border-gray-200'
                    }\`}
                  >
                    <span className="text-3xl font-extrabold text-gray-800 w-40">{timeUpper}</span>
                    
                    <div className="bg-gray-100 border-2 border-gray-200 rounded-xl px-8 py-4 flex items-center justify-center min-w-[120px]">
                      <span className="text-4xl font-bold text-gray-700">QTY {displayQty || '0'}</span>
                    </div>
                    
                    <div className="flex gap-4">
                      <button 
                        onClick={(e) => { e.stopPropagation(); useLabelStore.getState().openNumberPad(\`\${time}_fraction\` as any); }}
                        className="w-20 h-20 bg-white border-2 border-gray-400 text-gray-700 rounded-full text-2xl font-bold flex items-center justify-center active:bg-gray-100 shadow-sm transition-colors"
                      >
                        X/Y
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); useLabelStore.getState().decrementDosage(time); }}
                        className="w-20 h-20 bg-red-50 border-2 border-red-400 text-red-600 rounded-full text-5xl font-bold flex items-center justify-center pb-2 active:bg-red-100 shadow-sm transition-colors"
                      >
                        -
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); useLabelStore.getState().incrementDosage(time); }}
                        className="w-20 h-20 bg-green-50 border-2 border-green-400 text-green-600 rounded-full text-5xl font-bold flex items-center justify-center pb-2 active:bg-green-100 shadow-sm transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          `;
  const originalDosageChunk = code.substring(dosageStart, dosageEndComment);
  code = code.replace(originalDosageChunk, replacement);
  fs.writeFileSync(filePath, code);
  console.log('Replaced');
}
