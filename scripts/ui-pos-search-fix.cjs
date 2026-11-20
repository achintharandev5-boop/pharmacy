const fs=require('fs'),crypto=require('crypto');let p='apps/web/components/pos/PosWorkstation.tsx',s=fs.readFileSync(p,'utf8');s=s.replace('  const requestId = useRef(0);','  const requestId = useRef(0);\n  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);').replace("  const runSearch = useCallback(async (value: string) => {", "  const runSearch = useCallback(async (value: string) => {\n    // An explicit search replaces the queued type-ahead request.\n    if (searchTimer.current !== null) clearTimeout(searchTimer.current);\n    searchTimer.current = null;").replace(/    const timer = setTimeout\(\(\) => void runSearch\(q\), SEARCH_DELAY_MS\);\r?\n    return \(\) => clearTimeout\(timer\);/,'    searchTimer.current = setTimeout(() => { searchTimer.current = null; void runSearch(q); }, SEARCH_DELAY_MS);\r\n    return () => { if (searchTimer.current !== null) clearTimeout(searchTimer.current); searchTimer.current = null; };');
if(!s.includes('searchTimer.current = setTimeout'))throw Error('Timer replacement did not match');fs.writeFileSync(p,s);
p='apps/web/components/pos/PosWorkstation.test.tsx';const raw=fs.readFileSync(p),hash=JSON.parse(fs.readFileSync('docs/ui-modernization/source-baseline.json'))[p];if(crypto.createHash('sha256').update(raw).digest('hex')!==hash)throw Error('Concurrent POS test change');s=raw.toString('utf8');const test=`    it('submits a name search once when Enter precedes the type-ahead delay', async () => {
      api.searchPosCatalog.mockResolvedValue({ ok: true, data: [product()] });
      render(<PosWorkstation />);
      type('pana');
      enter();
      expect(await screen.findByRole('button', { name: 'Add Panadol 500mg' })).toBeInTheDocument();
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
      expect(api.searchPosCatalog).toHaveBeenCalledTimes(1);
    });

`;
s=s.replace("    it('shows a search failure as an error with Retry, never as an empty list'",test+"    it('shows a search failure as an error with Retry, never as an empty list'");fs.writeFileSync(p,s);
