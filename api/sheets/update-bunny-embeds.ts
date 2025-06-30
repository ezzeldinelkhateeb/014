import { google } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';
import { envConfig } from '../../src/lib/env-config';

interface VideoData {
  name: string;
  embed_code: string;
  final_minutes?: number;
}

interface UpdateResult {
  videoName: string;
  status: 'updated' | 'notFound' | 'skipped' | 'error';
  details?: string;
}

interface BatchUpdate {
  range: string;
  values: string[][]; 
}

interface UpdateResponse {
  success: boolean;
  message: string;
  results: Array<{
    videoName: string;
    status: 'updated' | 'notFound' | 'skipped' | 'error';
    details?: string;
  }> ;
  stats: {
    updated: number;
    notFound: number;
    skipped: number;
    error: number;
  };
}

interface VideoDataRequest {
  videos: Array<{
    name: string;
    embed_code: string;
    normalizedName?: string;
  }>[] ;
}

// تحسين دالة التطبيع لتتعامل بشكل أفضل مع النصوص العربية والرموز الخاصة
const normalizeString = (str: string): string => {
  if (!str) return '';

  console.log('[Normalize] Original:', str); // Enable this log for debugging

  let normalized = str
    .trim()
    // 1. Remove file extension first
    .replace(/\.[^/.]+$/, '')
    // 2. Extract essential parts - keep both Arabic and English text
    .replace(/(?:--|—|-)?\s*(?:واجب|homework|الحصة الرابعة|الحصة|درس)\s*\d*/gi, '')
    // 3. Remove content within all types of brackets
    .replace(/[\[\{\(].*?[\]\}\)]/g, '')
    // 4. Replace multiple dashes/underscores with a single space
    .replace(/[-_—]+/g, ' ')
    // 5. Normalize Arabic characters for better matching
    .replace(/[أإآ]/g, 'ا')
    .replace(/[يى]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    // 6. Remove extra whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  console.log('[Normalize] Final:', normalized); // Enable this log for debugging
  return normalized;
};

// Function to extract Q numbers with improved flexibility
const extractQNumbers = (str: string): string[] => {
  // Look for both "Q30" and "Q 30" formats and allow for Arabic digits too
  const qMatches = str.match(/q\s*\d+/gi);
  return qMatches 
    ? qMatches.map(q => q.toLowerCase().replace(/\s+/g, '').trim()).sort() 
    : [];
};

// Updated namesMatch function with better Arabic text handling and more fallbacks
const namesMatch = (nameA: string, nameB: string): boolean => {
  // CRITICAL ADDITION: Strip ".mp4" extension for consistent comparison of video names
  nameA = nameA.replace(/\.mp4$/i, '');
  nameB = nameB.replace(/\.mp4$/i, '');
  
  const normA = normalizeString(nameA);
  const normB = normalizeString(nameB);

  console.log(`[namesMatch] Comparing:\nA: "${normA}"\nB: "${normB}"`);

  // Direct match after normalization - MOST RELIABLE
  if (normA === normB) {
    console.log('[namesMatch] ✅ Direct exact match success.');
    return true;
  }

  // STRICTER: Extract core name (without Q numbers) and Q numbers separately
  const coreA = normA.replace(/q\s*\d+/gi, '').replace(/\s+/g, ' ').trim();
  const coreB = normB.replace(/q\s*\d+/gi, '').replace(/\s+/g, ' ').trim();
  const qNumbersA = extractQNumbers(normA);
  const qNumbersB = extractQNumbers(normB);

  console.log(`[namesMatch] CoreA: "${coreA}", QsA: [${qNumbersA.join(',')}]`);
  console.log(`[namesMatch] CoreB: "${coreB}", QsB: [${qNumbersB.join(',')}]`);

  // ENHANCED: Handle specific format M2-T2-U2-L2-SCI-AR-P0078... format with STRICT matching
  const codePatternA = normA.match(/(m\d+|s\d+|j\d+)-t\d+-u\d+-l\d+-(sci|ar|en|math)-\w+-(p\d+)/i);
  const codePatternB = normB.match(/(m\d+|s\d+|j\d+)-t\d+-u\d+-l\d+-(sci|ar|en|math)-\w+-(p\d+)/i);
  
  if (codePatternA && codePatternB) {
    const codeA = codePatternA[0].toLowerCase();
    const codeB = codePatternB[0].toLowerCase();
    
    if (codeA === codeB) {
      // Additional validation: ensure the rest of the name is similar too
      const remainingA = normA.replace(codeA, '').trim();
      const remainingB = normB.replace(codeB, '').trim();
      
      // Check if teacher name matches or if one remaining text contains the other
      const teacherMatch = remainingA.includes('muslim') && remainingB.includes('muslim') ||
                          remainingA.includes('elsayed') && remainingB.includes('elsayed');
      
      const similarRemaining = remainingA.includes(remainingB) || remainingB.includes(remainingA);
      
      if (teacherMatch || similarRemaining || remainingA.length < 10 || remainingB.length < 10) {
        console.log('[namesMatch] ✅ Exact code pattern match with compatible remaining text.');
        return true;
      } else {
        console.log('[namesMatch] ⚠️ Code pattern matches but remaining text differs significantly.');
        console.log(`RemainingA: "${remainingA}", RemainingB: "${remainingB}"`);
        // Continue to other matching methods instead of returning false immediately
      }
    }
  }

  // STRICTER: Match if the core parts are identical AND reasonably long
  if (coreA === coreB && coreA.length > 10) {
    console.log('[namesMatch] ✅ Core name exact match (ignoring Q numbers).');
    return true;
  }

  // STRICTER: Match if core names contain each other with higher threshold
  if ((coreA.includes(coreB) || coreB.includes(coreA)) && 
      (coreA.length > 15 && coreB.length > 15)) { // Increased threshold for safety
    const similarity = Math.min(coreA.length, coreB.length) / Math.max(coreA.length, coreB.length);
    if (similarity > 0.7) { // At least 70% similarity
      console.log('[namesMatch] ✅ Core name inclusion match with high similarity.');
      return true;
    }
  }

  // ENHANCED: Check for Q number matches with stricter core validation
  if (qNumbersA.length > 0 && qNumbersB.length > 0) {
    // Check if any Q numbers match between the two sets
    const hasCommonQNumbers = qNumbersA.some(qa => qNumbersB.includes(qa));
    
    if (hasCommonQNumbers) {
      // More strict core comparison for Q number matches
      const coresSimilar = coreA === coreB || 
                          (coreA.includes(coreB) && coreB.length > 10) ||
                          (coreB.includes(coreA) && coreA.length > 10);
      
      if (coresSimilar) {
        console.log('[namesMatch] ✅ Core name similarity and common Q numbers match.');
        return true;
      }
    }
  }

  // FINAL FALLBACK: Teacher code and course code matching with additional validation
  const courseCodePattern = /(m\d+|s\d+|j\d+)-(t\d+)?-(u\d+)?-(l\d+)?-(sci|ar|en|math)-\w+-(p\d+)/i;
  
  const courseCodeA = normA.match(courseCodePattern);
  const courseCodeB = normB.match(courseCodePattern);
  
  if (courseCodeA && courseCodeB) {
    const matchedPartsA = courseCodeA[0].toLowerCase();
    const matchedPartsB = courseCodeB[0].toLowerCase();
    
    // Only match if course codes are exactly the same
    if (matchedPartsA === matchedPartsB) {
      console.log('[namesMatch] ✅ Exact course code match.');
      return true;
    }
  }

  console.log('[namesMatch] ❌ No reliable match found - avoiding false positive.');
  return false;
};

// Update the findMatchingRow function to use the refined namesMatch and provide more debugging
const findMatchingRow = (videoName: string, rows: any[][], nameColumnIndex: number): number => {
  console.log(`[findMatchingRow] Finding match for: "${videoName}"`);

  // Debug first 5 rows
  console.log('First 5 rows in sheet:', rows.slice(0, 5).map(row => ({
    original: row && row[nameColumnIndex] ? row[nameColumnIndex] : 'N/A',
    normalized: row && row[nameColumnIndex] ? normalizeString(row[nameColumnIndex].toString()) : null
  })));
  
  // Preprocess videoName to handle different formats
  const processedVideoName = videoName.replace(/\.mp4$/i, ''); // Remove .mp4 extension

  // Try exact match first (faster) 
  let exactMatchIndex = rows.findIndex((row) => {
    if (!row || !row[nameColumnIndex]) return false;
    return row[nameColumnIndex].toString().trim() === processedVideoName;
  });
  
  if (exactMatchIndex !== -1) {
    console.log(`[findMatchingRow] ✅ Exact string match at row ${exactMatchIndex + 1}`);
    return exactMatchIndex;
  }
  
  // Try normalized match
  const rowIndex = rows.findIndex((row, idx) => {
    // Ensure row and the specific cell exist and are not empty
    if (!row || typeof row[nameColumnIndex] === 'undefined' || row[nameColumnIndex] === null || row[nameColumnIndex] === '') {
      return false;
    }

    const sheetName = row[nameColumnIndex].toString();
    const match = namesMatch(videoName, sheetName);

    if (match) {
      console.log(`[findMatchingRow] ✅ MATCH FOUND at row ${idx + 1}: "${sheetName}"`);
    }

    return match;
  });

  console.log('[findMatchingRow] Match result:', rowIndex !== -1 ?
    `Found at row ${rowIndex + 1}` :
    'No match found');

  return rowIndex;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UpdateResponse>
) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
      results: [],
      stats: { updated: 0, notFound: 0, skipped: 0, error: 0 }
    });
  }

  try {
    const { videos, spreadsheetId, sheetName, nameColumn = 'M', embedColumn = 'V', finalMinutesColumn = 'P' } = req.body;

    if (!Array.isArray(videos) || videos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No videos provided',
        results: [],
        stats: { updated: 0, notFound: 0, skipped: 0, error: 0 }
      });
    }

    if (!spreadsheetId || !sheetName) {
      return res.status(400).json({
        success: false,
        message: 'Missing spreadsheetId or sheetName',
        results: [],
        stats: { updated: 0, notFound: 0, skipped: 0, error: 0 }
      });
    }

    // Convert column letters to zero-based indices
    const nameColIndex = nameColumn.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
    const embedColIndex = embedColumn.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
    const finalMinutesColIndex = finalMinutesColumn.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
    const maxColIndex = Math.max(nameColIndex, embedColIndex, finalMinutesColIndex);
    const endColumnLetter = String.fromCharCode('A'.charCodeAt(0) + maxColIndex);
    const range = `${sheetName}!A:${endColumnLetter}`; // Fetch enough columns

    const { credentials } = envConfig.googleSheets;

    if (!credentials) {
      throw new Error('Missing Google Sheets credentials');
    }

    // ... auth setup ...
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });


    // Get existing data
    console.log(`[Handler] Fetching sheet data from range: ${range}`);
    const sheetResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: range, // Use calculated range
      valueRenderOption: 'UNFORMATTED_VALUE' // Keep as is
    });

    const rows = sheetResponse.data.values || [];
    console.log(`[Handler] Fetched ${rows.length} rows.`);
    
    // Debug: Log a sample of sheet data
    console.log('[Handler] Sheet data sample:', 
      rows.slice(0, 3).map(row => row ? row.slice(0, 3) : 'Empty row'));

    const existingEmbeds = new Map<number, string>();

    // Populate existing embeds map using the correct index
    rows.forEach((row, index) => {
      if (row && row[embedColIndex]) {
        existingEmbeds.set(index + 1, row[embedColIndex].toString());
      }
    });

    const results: UpdateResult[] = [];
    const updates: BatchUpdate[] = [];
    const stats = {
      updated: 0,
      notFound: 0,
      skipped: 0,
      error: 0
    };

    // Process each video
    for (const video of videos) {
      console.log(`[Handler] Processing video: "${video.name}"`);

      // Clean up the video name for more consistent matching
      video.normalizedName = normalizeString(video.name);
      console.log(`[Handler] Normalized name: "${video.normalizedName}"`);

      // IMPORTANT: Transform the video name to make it more compatible with sheet entries
      const processedVideoName = video.name.replace(/\.mp4$/i, '');
      console.log(`[Handler] Processed for matching: "${processedVideoName}"`);

      // Use the updated findMatchingRow with the correct name column index
      const rowIndex = findMatchingRow(processedVideoName, rows, nameColIndex);
      const rowNumber = rowIndex + 1; // 1-based row number
      const existingEmbed = rowIndex !== -1 ? existingEmbeds.get(rowNumber) : undefined;

      console.log('[Handler] Processing status:', {
        videoName: video.name,
        foundMatch: rowIndex !== -1,
        row: rowNumber,
        hasExistingEmbed: !!existingEmbed,
        embedValue: existingEmbed ? existingEmbed.substring(0, 50) + '...' : 'null'
      });

      let currentStatus: UpdateResult['status'] = 'error'; // Default to error
      let details = '';

      if (rowIndex === -1) {
        currentStatus = 'notFound';
        details = 'Video name not found in sheet';
        stats.notFound++;
        console.log(`❌ [NOT FOUND] "${video.name}" - No matching row found in sheet`);
      } else if (existingEmbed && existingEmbed.trim().length > 0) {
        currentStatus = 'skipped';
        details = 'Cell already contains embed code';
        stats.skipped++;
        console.log(`⏭️ [SKIPPED] "${video.name}" - Row ${rowNumber} already has embed code`);
      } else {
        // Only update if found and embed cell is empty
        currentStatus = 'updated';
        details = 'Successfully updated embed code';
        stats.updated++;
        
        // Add embed code update
        if (video.embed_code) {
          updates.push({
            range: `${sheetName}!${embedColumn}${rowNumber}`, // Use original letter for range
            values: [[video.embed_code]]
          });
          console.log(`✅ [WILL UPDATE] "${video.name}" - Row ${rowNumber}, Column ${embedColumn}`);
        }
        
        // Add final minutes update if provided
        if (video.final_minutes !== undefined) {
          updates.push({
            range: `${sheetName}!${finalMinutesColumn}${rowNumber}`, // Use final minutes column
            values: [[video.final_minutes]]
          });
          console.log(`⏰ [WILL UPDATE FINAL MINUTES] "${video.name}" - Row ${rowNumber}, Column ${finalMinutesColumn}, Value: ${video.final_minutes}`);
        }
      }

      const result: UpdateResult = {
        videoName: video.name,
        status: currentStatus,
        details: details
      };

      console.log('[Handler] Result for video:', result);
      results.push(result);
    }

    // Perform batch update if there are updates
    if (updates.length > 0) {
      console.log(`[Handler] ⚡ PERFORMING BATCH UPDATE for ${updates.length} cell updates:`, 
        updates.map(u => u.range).join(', '));
      
      try {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            data: updates,
            valueInputOption: 'USER_ENTERED' // Use USER_ENTERED to treat value as embed code/HTML
          }
        });
        console.log('[Handler] ✅ BATCH UPDATE SUCCESSFUL - All updates applied to sheet');
      } catch (updateError) {
        console.error('[Handler] ❌ BATCH UPDATE FAILED:', updateError);
        
        // Mark all updated videos as errors since the batch update failed
        results.forEach(result => {
          if (result.status === 'updated') {
            result.status = 'error';
            result.details = 'Failed to update sheet - batch update error';
            stats.updated--;
            stats.error++;
          }
        });
        
        throw updateError; // Re-throw to trigger catch block
      }
    } else {
      console.log('[Handler] ⚠️ NO UPDATES TO PERFORM - All videos were either not found or skipped');
    }

    // VALIDATION: Ensure we don't claim success if no actual updates occurred
    const actuallyUpdated = stats.updated;
    const hasErrors = stats.error > 0;
    const overallSuccess = actuallyUpdated > 0 && !hasErrors;

    console.log(`[Handler] FINAL STATS: Updated=${stats.updated}, NotFound=${stats.notFound}, Skipped=${stats.skipped}, Error=${stats.error}`);
    console.log(`[Handler] OVERALL SUCCESS: ${overallSuccess} (Updated: ${actuallyUpdated}, HasErrors: ${hasErrors})`);

    // Improve response structure
    return res.status(200).json({
      success: overallSuccess, // Only true if we actually updated something without errors
      message: actuallyUpdated > 0 
        ? `تم اكتمال العملية بنجاح: ${stats.updated} تم تحديثه, ${stats.notFound} غير موجود, ${stats.skipped} تم تخطيه`
        : `لم يتم تحديث أي فيديو: ${stats.notFound} غير موجود, ${stats.skipped} تم تخطيه`,
      results: results.map(r => ({
        videoName: r.videoName,
        status: r.status,
        details: r.details || undefined
      })),
      stats
    });

  } catch (error) {
    console.error('[Handler] Error in sheet update:', error);
    // Check for specific Google API errors
    let message = 'Internal server error during sheet update';
    if (error.response?.data?.error?.message) {
        message = `Google Sheets API Error: ${error.response.data.error.message}`;
    } else if (error instanceof Error) {
        message = error.message;
    }
    
    return res.status(500).json({
      success: false,
      message: message,
      results: [],
      stats: { updated: 0, notFound: 0, skipped: 0, error: 1 } // Indicate error in stats
    });
  }
}
