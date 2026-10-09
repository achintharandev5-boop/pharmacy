const fs = require('fs');
const storePath = 'apps/web/store/labelStore.ts';

let storeCode = fs.readFileSync(storePath, 'utf8');

// Update StoreState interface
storeCode = storeCode.replace(
  'additionalInstructions: string[];',
  'additionalInstructions: string[];\n  selectedDaysOfWeek: string[];\n  openDaysOfWeekPanel: () => void;\n  closeDaysOfWeekPanel: () => void;\n  toggleDayOfWeek: (day: string) => void;'
);

// Update initial state
storeCode = storeCode.replace(
  'additionalInstructions: [],',
  'additionalInstructions: [],\n  selectedDaysOfWeek: [],'
);

// Update allClear
storeCode = storeCode.replace(
  'additionalInstructions: [],',
  'additionalInstructions: [],\n    selectedDaysOfWeek: [],'
);

// Add action methods
const storeEnd = storeCode.lastIndexOf('}));');
if (storeEnd !== -1) {
  const actions = `
  openDaysOfWeekPanel: () => set({ activeControl: 'days_of_week' }),
  closeDaysOfWeekPanel: () => set({ activeControl: 'idle' }),
  toggleDayOfWeek: (day) => set((state) => {
    let updated = [...state.selectedDaysOfWeek];
    if (updated.includes(day)) {
      updated = updated.filter(d => d !== day);
    } else {
      updated.push(day);
    }
    return { selectedDaysOfWeek: updated };
  }),
`;
  storeCode = storeCode.substring(0, storeEnd) + actions + storeCode.substring(storeEnd);
}
fs.writeFileSync(storePath, storeCode);
console.log('Store updated');
