'use client';
import React from 'react';

export function LabelCard({ labelItem }: { labelItem: any }) {
  if (!labelItem) return null;

  const removeAddress = labelItem.showAddress === false || labelItem.additionalInstructions?.includes('REMOVE ADDRESS');

  // Collect all Sinhala instructions
  const sinhalaInstructions = labelItem.additionalInstructions?.filter((inst: string) =>
    /[\u0D80-\u0DFF]/.test(inst)
  ) || [];

  const FREQUENCY_TAGS = ['STAT', 'SOS', '6H', '8H', '5H', 'EOD', 'DAILY', 'EVENING'];

  const otherInstructions = labelItem.additionalInstructions?.filter(
    (inst: string) => !/[\u0D80-\u0DFF]/.test(inst) && 
                      inst !== 'REMOVE ADDRESS' && 
                      inst !== 'ADD EXP DATE' && 
                      inst !== 'REASONS' &&
                      !FREQUENCY_TAGS.includes(inst)
  ) || [];

  // Expiry date: only what was recorded on this label; never looked up from sample data
  const expDate = labelItem.expiryDate || labelItem.expDate || null;
  const prodName = labelItem.productName || labelItem.product?.name || '';

  const customerName = labelItem.customerName || '';
  const hasQty = Boolean(labelItem.productQuantity && String(labelItem.productQuantity).trim());

  // Date of issue (DD/MM/YYYY)
  const now = new Date();
  const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  const reasonText = labelItem.reasons?.length ? labelItem.reasons.join(', ') : (labelItem.reason || '');

  return (
    <div 
      className="print-label-page w-[70mm] h-[50mm] min-w-[70mm] max-w-[70mm] min-h-[50mm] max-h-[50mm] border border-black box-border flex flex-col bg-white text-black leading-none overflow-hidden select-none"
      style={{
        boxSizing: 'border-box',
        fontFamily: "'Segoe UI', Arial, 'Gemunu Libre', 'Noto Sans Sinhala', sans-serif"
      }}
    >
      
      {/* SECTION 1: Product Name & Quantity (Height: 5.5mm) */}
      <div className="h-[5.5mm] min-h-[5.5mm] max-h-[5.5mm] border-b border-black flex items-center justify-between px-2 font-black text-[11.5px] leading-none bg-white">
        <span className="truncate max-w-[52mm] uppercase tracking-wide">
          {prodName || 'MEDICINE'}
        </span>
        {hasQty && (
          <span className="shrink-0 font-black text-[10.5px]">
            Qty: {labelItem.productQuantity}
          </span>
        )}
      </div>

      {/* SECTION 2: Sub-header Row (Height: 5.0mm) */}
      {labelItem.alternativeProductName ? (
        <div className="h-[5.0mm] min-h-[5.0mm] max-h-[5.0mm] border-b border-black flex leading-none">
          {/* Left Cell (Width: 32mm): Alternative Brand Name */}
          <div className="w-[32mm] min-w-[32mm] max-w-[32mm] border-r border-black flex items-center justify-center px-1 text-[9px] text-center font-bold truncate">
            <span>Brand: {labelItem.alternativeProductName}</span>
          </div>
          {/* Right Cell (Width: 38mm): Patient Name & Issue Date */}
          <div className="w-[38mm] min-w-[38mm] max-w-[38mm] flex items-center justify-between px-2 text-[9px]">
            <span className="font-extrabold truncate max-w-[24mm]" title={customerName}>
              {customerName ? `Pt: ${customerName}` : 'Pt: _________'}
            </span>
            <span className="text-[8.5px] font-bold text-slate-800 shrink-0">
              {todayStr}
            </span>
          </div>
        </div>
      ) : (
        <div className="h-[5.0mm] min-h-[5.0mm] max-h-[5.0mm] border-b border-black flex items-center justify-between px-2 text-[9.5px] leading-none">
          <span className="font-extrabold truncate max-w-[45mm]" title={customerName}>
            {customerName ? `Patient: ${customerName}` : 'Patient: ________________________'}
          </span>
          <span className="text-[9px] font-bold text-slate-800 shrink-0">
            Date: {todayStr}
          </span>
        </div>
      )}

      {/* SECTION 3: Main Prescription Body (Height: 26.0mm) */}
      <div className="h-[26.0mm] min-h-[26.0mm] max-h-[26.0mm] flex flex-col items-center justify-center px-1 py-0.5 text-center leading-tight overflow-hidden gap-1">
        
        {/* Row 1: Dosage Breakdown with Circled Badges */}
        {labelItem.dosage && (labelItem.dosage.morning || labelItem.dosage.lunch || labelItem.dosage.night) && (
          <div className="flex items-center justify-center gap-3 font-extrabold text-[13px] text-black">
            {labelItem.dosage.morning && (
              <span className="inline-flex items-center gap-1.5">
                <span className="sinhala-text font-bold text-[13px]">උදේ</span>
                <span className="inline-flex items-center justify-center border-[1.5px] border-black rounded-full min-w-[22px] h-[22px] px-1 text-[12px] font-black bg-white">
                  {labelItem.dosage.morning}
                </span>
              </span>
            )}
            {labelItem.dosage.lunch && (
              <span className="inline-flex items-center gap-1.5">
                <span className="sinhala-text font-bold text-[13px]">දවල්</span>
                <span className="inline-flex items-center justify-center border-[1.5px] border-black rounded-full min-w-[22px] h-[22px] px-1 text-[12px] font-black bg-white">
                  {labelItem.dosage.lunch}
                </span>
              </span>
            )}
            {labelItem.dosage.night && (
              <span className="inline-flex items-center gap-1.5">
                <span className="sinhala-text font-bold text-[13px]">රෑ</span>
                <span className="inline-flex items-center justify-center border-[1.5px] border-black rounded-full min-w-[22px] h-[22px] px-1 text-[12px] font-black bg-white">
                  {labelItem.dosage.night}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Frequency Dosage with Circled Badge */}
        {labelItem.frequencyDosage && (
          <div className="flex items-center justify-center flex-wrap font-bold text-[13.5px] text-black sinhala-text">
            <span>පෙති</span>
            <span className="inline-flex items-center justify-center border-[1.5px] border-black rounded-full min-w-[22px] h-[22px] px-1 text-[12px] font-black mx-1.5 font-sans bg-white">
              {labelItem.frequencyDosage.qty}
            </span>
            <span>
              {labelItem.frequencyDosage.freqLabel === '8H' ? 'බැගින් පැය 8කට වරක්' :
               labelItem.frequencyDosage.freqLabel === '6H' ? 'බැගින් පැය 6කට වරක්' :
               labelItem.frequencyDosage.freqLabel === '5H' ? 'බැගින් පැය 5කට වරක්' :
               labelItem.frequencyDosage.freqLabel === 'DAILY' ? 'බැගින් දිනපතා' :
               labelItem.frequencyDosage.freqLabel === 'EVENING' ? 'බැගින් සවසට' :
               labelItem.frequencyDosage.freqLabel === 'EOD' ? 'බැගින් දිනක් හැර දිනක්' :
               labelItem.frequencyDosage.freqLabel === 'SOS' ? 'බැගින් අවශ්‍ය විට පමණක්' :
               'වරක්'}
            </span>
          </div>
        )}

        {/* Row 2: Sinhala Meal Timing & Administration Instructions */}
        {sinhalaInstructions.length > 0 && (
          <div className="flex flex-col items-center gap-0.5">
            {sinhalaInstructions.map((inst: string, i: number) => (
              <div 
                key={i} 
                className="sinhala-text text-[13.5px] font-bold text-black tracking-wide leading-snug"
              >
                {inst}
              </div>
            ))}
          </div>
        )}

        {/* Row 3: Reason for Use (clean stylish text) */}
        {reasonText && (
          <div className="sinhala-text text-[12px] font-bold text-black tracking-wide leading-tight">
            ( {reasonText} )
          </div>
        )}

        {/* Row 4: Days Duration */}
        {labelItem.days && (
          <div className="sinhala-text text-[10.5px] font-bold text-black tracking-wide">
            දින {labelItem.days} ක් සඳහා (FOR {labelItem.days} DAYS)
          </div>
        )}

        {/* Selected Days of the Week */}
        {labelItem.selectedDaysOfWeek && labelItem.selectedDaysOfWeek.length > 0 && (
          <div className="sinhala-text text-[9.5px] font-bold text-black tracking-wide">
            ({labelItem.selectedDaysOfWeek.join(', ')} දිනවල පමණක්)
          </div>
        )}

        {/* STAT instructions */}
        {labelItem.stat && (
          <div className="font-black text-[10px] uppercase bg-black text-white px-2 py-0.5 rounded-sm">
            {labelItem.stat}
          </div>
        )}

        {/* Other instruction tags */}
        {otherInstructions.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1">
            {otherInstructions.map((inst: string) => (
              <span key={inst} className="border border-black px-1 text-[8px] font-bold rounded-sm uppercase">
                {inst}
              </span>
            ))}
          </div>
        )}

      </div>

      {/* SECTION 4: Expiration Row (Height: 4.0mm) */}
      <div className="h-[4.0mm] min-h-[4.0mm] max-h-[4.0mm] border-t border-b border-black flex items-center justify-between px-2 text-[8.5px] font-bold uppercase tracking-wider bg-white">
        <span className="text-[8px] font-semibold text-black">DISPENSED BY: SISILA</span>
        <span className="font-extrabold text-black">
          EXP DATE{expDate ? ` : ${expDate}` : ' : ___________'}
        </span>
      </div>

      {/* SECTION 5: Chemist Footer (Height: 9.5mm) */}
      <div className="h-[9.5mm] min-h-[9.5mm] max-h-[9.5mm] flex flex-col items-center justify-center text-center leading-none px-1 py-0.5 gap-[1.5px] bg-white">
        <span className="font-serif font-black text-[11.5px] tracking-wider text-black uppercase">
          SISILA CHEMIST
        </span>
        {!removeAddress && (
          <span className="font-sans font-semibold text-[8px] text-black tracking-tight">
            No200, Koralawella, Moratuwa
          </span>
        )}
        <span className="font-sans font-extrabold text-[7.5px] text-black tracking-tight">
          Tel - 011 265 88 88 / Mob - 0777 636 500
        </span>
      </div>

    </div>
  );
}

export function PrintableLabel({ data }: { data: any }) {
  if (!data) return null;

  const items = Array.isArray(data) ? data : [data];
  if (items.length === 0) return null;

  return (
    <div className="print-only">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Gemunu+Libre:wght@400;500;600;700;800&family=Noto+Sans+Sinhala:wght@400;500;600;700;800;900&display=swap');
        
        .sinhala-text {
          font-family: 'Gemunu Libre', 'Noto Sans Sinhala', 'Segoe UI', Arial, sans-serif !important;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        @media print {
          html, body {
            width: 70mm !important;
            height: 50mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 70mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            z-index: 999999 !important;
            font-family: 'Segoe UI', Arial, 'Gemunu Libre', 'Noto Sans Sinhala', sans-serif;
            color: #000000;
          }
          .print-label-page {
            width: 70mm !important;
            height: 50mm !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            break-after: page !important;
            overflow: hidden !important;
          }
          .print-only * {
            box-sizing: border-box !important;
          }
          @page {
            size: 70mm 50mm;
            margin: 0;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}} />
      
      {items.map((labelItem: any, idx: number) => (
        <LabelCard key={labelItem.id || idx} labelItem={labelItem} />
      ))}
    </div>
  );
}


