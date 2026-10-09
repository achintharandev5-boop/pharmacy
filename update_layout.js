const fs = require('fs');

const filePath = 'apps/web/app/label/page.tsx';
let code = fs.readFileSync(filePath, 'utf8');

const rightColumnReplacement = `
        {/* RIGHT COLUMN */}
        <div className="flex-[6] flex flex-col gap-4 justify-center">
          
          {/* DOSAGE ROWS (MORNING / LUNCH / NIGHT) */}
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

          {/* ACTION BUTTONS GRID */}
          <div className="grid grid-cols-4 grid-rows-3 gap-3 mt-2">
            {[
              // ROW 1
              'ADD LABEL', 'REMOVE ADDRESS', 'GIVE', 'TAKE',
              // ROW 2
              'DELETE LABEL', 'DAYS', 'BEFORE', 'AFTER'
            ].map(btn => {
              if (SECONDARY_INSTRUCTIONS.includes(btn)) {
                return (
                  <ToggleButton 
                    key={btn}
                    label={btn}
                    isActive={useLabelStore.getState().additionalInstructions.includes(btn)}
                    onClick={() => {
                      if (!isStatActive) useLabelStore.getState().toggleAdditionalInstruction(btn);
                    }}
                    className={\`h-14 w-full text-sm font-bold shadow-sm \${isStatActive ? 'opacity-50 pointer-events-none' : ''}\`}
                  />
                );
              }
              return (
                <button 
                  key={btn}
                  disabled={isStatActive}
                  className={\`
                    h-14 w-full rounded-xl font-bold text-sm shadow-sm border-2 transition-colors flex items-center justify-center bg-white text-gray-700 border-gray-300 active:bg-gray-100
                    \${isStatActive ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''}
                  \`}
                >
                  {btn === 'DAYS' ? (
                    <div className="flex flex-col items-center leading-none">
                      <span>DAYS</span>
                      <span className="text-gray-400 text-xs mt-1">.......</span>
                    </div>
                  ) : btn}
                </button>
              );
            })}

            {/* ROW 3 */}
            <div className="col-span-2 flex gap-2">
              <button disabled={isStatActive} className={\`w-14 rounded-xl font-bold text-2xl shadow-sm border-2 border-gray-300 bg-white text-gray-400 active:bg-gray-100 flex items-center justify-center \${isStatActive ? 'opacity-50 pointer-events-none' : ''}\`}>◄</button>
              <button disabled={isStatActive} className={\`flex-1 rounded-full font-bold text-sm shadow-sm border-2 border-gray-300 bg-white text-gray-700 active:bg-gray-100 flex items-center justify-center \${isStatActive ? 'opacity-50 pointer-events-none' : ''}\`}>LABEL NO</button>
              <button disabled={isStatActive} className={\`w-14 rounded-xl font-bold text-2xl shadow-sm border-2 border-gray-300 bg-white text-gray-400 active:bg-gray-100 flex items-center justify-center \${isStatActive ? 'opacity-50 pointer-events-none' : ''}\`}>►</button>
            </div>
            
            <button disabled={isStatActive} className={\`rounded-full font-bold text-xs shadow-sm border-2 border-gray-300 bg-white text-gray-700 active:bg-gray-100 flex items-center justify-center \${isStatActive ? 'opacity-50 pointer-events-none' : ''}\`}>EXP DATE PANEL</button>
            
            <button 
              onClick={handlePrint}
              disabled={isStatActive}
              className={\`rounded-xl font-bold text-xl shadow-sm border-2 border-green-700 bg-green-600 text-white active:bg-green-800 flex items-center justify-center \${isStatActive ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''}\`}
            >
              PRINT
            </button>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}
`;

const rightColumnStart = code.indexOf('{/* RIGHT COLUMN */}');
const newCode = code.substring(0, rightColumnStart) + rightColumnReplacement;
fs.writeFileSync(filePath, newCode);
console.log('Layout updated.');
