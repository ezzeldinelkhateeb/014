import { LibraryMatch, LibraryInfo, QueueItem } from "./types";
import { parseFilename, findMatchingLibrary, determineCollection, determineLibrary } from "../filename-parser";
import { bunnyService } from "../bunny-service";
import { showToast } from "../../hooks/use-toast";
import { dataStorage } from "../data-storage";
import { LibraryInfo as LibraryDataInfo } from "../../types/library-data";

export class LibraryMatcher {
  // Cache for successful matches to speed up future matches - enhanced with pattern variations
  private matchCache = new Map<string, { libraryId: string, libraryName: string, confidence: number }>();
  // Cache for user-selected matches - these will have highest priority
  private userSelectionCache = new Map<string, { libraryId: string, libraryName: string }>();
  // Cache for subject/branch conflicts (like SCI-AR combinations)
  private subjectConflictCache = new Map<string, { libraryId: string, libraryName: string }>();
  // Manual mappings for learning from manual selections
  private manualMappings = new Map<string, { libraryId: string, libraryName: string }>();

  constructor() {
    this.loadManualMappings(); // Load saved mappings
  }

  /**
   * Attempts to match a library for the given file item.
   */
  async tryMatchLibrary(item: QueueItem, failedItems: QueueItem[], queue: QueueItem[]): Promise<void> {
    try {
      const libraries = await this.getLibraries();
      if (!libraries || libraries.length === 0) {
        throw new Error("No libraries available to match against.");
      }

      const parseResult = parseFilename(item.filename);
      if (!parseResult) {
        throw new Error("Could not parse filename");
      }

      // Try exact matches first (100% confidence)
      const exactFilenameMatch = this.userSelectionCache.get(item.filename);
      if (exactFilenameMatch) {
        this.applyMatchAndCache(item, exactFilenameMatch.libraryId, exactFilenameMatch.libraryName, 100, parseResult);
        return;
      }

      // Get best match and suggested alternatives
      const bestMatch = await this.findBestMatch(parseResult, item.filename, libraries);
      
      // Check cached patterns for this filename pattern
      const patternKey = this.getFilePatternKey(item.filename);
      const patternMatch = this.matchCache.get(patternKey);

      if (patternMatch) {
        // Use cached match if available
        this.applyMatchAndCache(item, patternMatch.libraryId, patternMatch.libraryName, patternMatch.confidence, parseResult);
        return;
      }

      const suggestedLibraries = this.getSuggestedLibraries(parseResult, libraries, bestMatch?.library?.id);
      item.metadata.suggestedLibraries = suggestedLibraries.map(match => ({
        id: match.id,
        name: match.name,
        confidence: match.score || 0 // Convert score to confidence
      }));

      // Auto-apply match if meets any of these criteria:
      // 1. Has high confidence (80% or higher)
      // 2. Exact teacher code match present in library name
      // 3. Meets special matching rules
      const hasHighConfidence = bestMatch && bestMatch.confidence >= 80;
      const exactTeacherCodeMatch = parseResult.teacherCode && bestMatch?.library?.name.includes(parseResult.teacherCode);
      const hasSpecialMatch = bestMatch && this.checkSpecialMatchRules(parseResult, bestMatch);

      if (bestMatch?.library && (hasHighConfidence || exactTeacherCodeMatch || hasSpecialMatch)) {
        this.applyMatchAndCache(item, bestMatch.library.id, bestMatch.library.name, bestMatch.confidence, parseResult);
        console.log(`Auto-matched "${item.filename}" to library "${bestMatch.library.name}" (confidence: ${bestMatch.confidence}%)`);
      } else {
        // Needs manual selection
        item.metadata.needsManualSelection = true;
        item.metadata.library = "";
        item.metadata.libraryName = "";
        item.metadata.suggestedLibraryName = this.determineSuggestedLibraryName(item.filename, parseResult.academicYear);
        
        const collectionResult = determineCollection(parseResult);
        item.metadata.collection = collectionResult.name;
        item.metadata.reason = collectionResult.reason;
        item.metadata.confidence = bestMatch?.confidence || 0;
      }

    } catch (error) {
      console.error(`Error matching library for ${item.filename}:`, error);
      item.metadata.needsManualSelection = true;
      item.metadata.library = "";
      item.metadata.libraryName = "";
      item.metadata.collection = "";
      item.metadata.confidence = 0;
    }
  }

  /**
   * Apply match to item and notify with appropriate message
   */
  private applyMatchAndNotify(
    item: QueueItem, 
    libraryId: string, 
    libraryName: string, 
    confidence: number, 
    matchSource: string
  ): void {
    item.metadata.library = libraryId;
    item.metadata.libraryName = libraryName;
    item.metadata.needsManualSelection = false;
    item.metadata.confidence = confidence;
    
    const parseResult = parseFilename(item.filename);
    const collectionResult = determineCollection(parseResult);
    item.metadata.collection = collectionResult.name;
    item.metadata.reason = collectionResult.reason;

    showToast({
      title: "✅ مكتبة محددة تلقائياً",
      description: `تم تعيين "${item.filename}" للمكتبة "${libraryName}" ${matchSource} (ثقة: ${confidence}%)`,
      variant: "success",
      duration: 2000
    });
  }

  /**
   * Apply match and cache various patterns for future use
   */
  private applyMatchAndCache(
    item: QueueItem, 
    libraryId: string, 
    libraryName: string, 
    confidence: number, 
    parseResult: any
  ): void {
    // Basic application
    item.metadata.library = libraryId;
    item.metadata.libraryName = libraryName;
    item.metadata.needsManualSelection = false;
    item.metadata.confidence = confidence;
    
    // Set collection based on parsed information
    const collectionResult = determineCollection(parseResult);
    item.metadata.collection = collectionResult.name;
    item.metadata.reason = collectionResult.reason;
    
    // Cache for future matches - multiple patterns
    const patternKey = this.getFilePatternKey(item.filename);
    this.matchCache.set(patternKey, {
      libraryId,
      libraryName,
      confidence
    });
    
    // Cache grade-subject-teacher pattern
    const gradeSubjectTeacherKey = this.getGradeSubjectTeacherKey(parseResult);
    if (gradeSubjectTeacherKey) {
      this.matchCache.set(gradeSubjectTeacherKey, {
        libraryId,
        libraryName,
        confidence
      });
    }
    
    // Cache alternate patterns for more coverage
    const alternateKeys = this.generateAlternateKeys(parseResult);
    alternateKeys.forEach(key => {
      if (key && key !== patternKey) {
        this.matchCache.set(key, {
          libraryId,
          libraryName,
          confidence: confidence - 5 // Slightly lower confidence for alternates
        });
      }
    });
    
    // Check if this is a subject conflict case
    const conflictKey = this.getSubjectConflictKey(item.filename, parseResult);
    if (conflictKey) {
      this.subjectConflictCache.set(conflictKey, {
        libraryId,
        libraryName
      });
    }
  }

  /**
   * Creates a special key for subject conflict patterns like SCI-AR combinations
   */
  private getSubjectConflictKey(filename: string, parsed: any): string | null {
    if (!parsed) return null;
    
    // Check for SCI-AR conflict pattern
    if (filename.match(/SCI.*AR|AR.*SCI/i)) {
      const parts = [];
      if (parsed.academicYear) parts.push(parsed.academicYear);
      if (parsed.teacherCode) parts.push(parsed.teacherCode);
      else if (parsed.teacherName) {
        const simplifiedName = parsed.teacherName.split(' ')[0].toLowerCase();
        parts.push(simplifiedName);
      }
      
      if (parts.length > 0) {
        return `conflict:${parts.join('-')}`;
      }
    }
    return null;
  }

  /**
   * Get a key based on teacher identification for strong matching
   */
  private getTeacherPatternKey(filename: string, parsed: any): string | null {
    if (!parsed) return null;
    
    const parts = [];
    
    // Include grade/level for context
    if (parsed.academicYear) {
      parts.push(parsed.academicYear);
    }
    
    // Focus on teacher identification
    if (parsed.teacherCode) {
      parts.push(parsed.teacherCode);
    } else if (parsed.teacherName) {
      // Normalize teacher name to handle variations
      const normalizedName = this.normalizeTeacherName(parsed.teacherName);
      if (normalizedName.length >= 4) { // Only if name is substantial
        parts.push(`name:${normalizedName}`);
      }
    }
    
    if (parts.length >= 2) {
      return `teacher:${parts.join('-')}`;
    }
    
    return null;
  }

  /**
   * Get a key based on grade, subject, and teacher
   */
  private getGradeSubjectTeacherKey(parsed: any): string | null {
    if (!parsed) return null;
    
    const parts = [];
    
    if (parsed.academicYear) parts.push(parsed.academicYear);
    if (parsed.branch) parts.push(parsed.branch);
    
    // Add teacher identifier (code or name)
    if (parsed.teacherCode) {
      parts.push(parsed.teacherCode);
    } else if (parsed.teacherName) {
      const firstNamePart = parsed.teacherName.split(' ')[0];
      if (firstNamePart && firstNamePart.length >= 3) {
        parts.push(firstNamePart.toLowerCase());
      }
    }
    
    if (parts.length >= 2) {
      return parts.join('-');
    }
    
    return null;
  }

  /**
   * Generate alternate key variations to improve matching
   */
  private generateAlternateKeys(parsed: any): string[] {
    const keys: string[] = [];
    
    if (!parsed) return keys;
    
    // Create branch/subject variations
    if (parsed.academicYear && parsed.branch) {
      // 1. Try with branch/subject swapped if it's AR/SCI
      if (parsed.branch === 'SCI') {
        keys.push(`${parsed.academicYear}-AR${parsed.teacherCode ? '-' + parsed.teacherCode : ''}`);
      } else if (parsed.branch === 'AR') {
        keys.push(`${parsed.academicYear}-SCI${parsed.teacherCode ? '-' + parsed.teacherCode : ''}`);
      }
      
      // 2. Try with just grade and teacher (no branch)
      if (parsed.teacherCode) {
        keys.push(`${parsed.academicYear}-${parsed.teacherCode}`);
      } else if (parsed.teacherName) {
        const firstNamePart = parsed.teacherName.split(' ')[0];
        if (firstNamePart) {
          keys.push(`${parsed.academicYear}-${firstNamePart.toLowerCase()}`);
        }
      }
    }
    
    // 3. If we have teacher code but no specific branch, try common ones
    if (parsed.academicYear && parsed.teacherCode && !parsed.branch) {
      const commonSubjects = ['AR', 'EN', 'SCI', 'MATH', 'SS'];
      commonSubjects.forEach(subj => {
        keys.push(`${parsed.academicYear}-${subj}-${parsed.teacherCode}`);
      });
    }
    
    return keys.filter(Boolean); // Filter out any that might be empty
  }

  /**
   * Check if the match should be accepted despite lower confidence
   */
  private checkSpecialMatchRules(parsed: any, bestMatch?: LibraryMatch | null): boolean {
    if (!bestMatch || !bestMatch.library) return false;

    // Rule 1: Exact teacher code match with reasonable confidence (>=55%)
    if (parsed.teacherCode && 
        bestMatch.library.name.includes(parsed.teacherCode) && 
        bestMatch.confidence >= 55) {
      return true;
    }

    // Rule 2: Academic year + subject + first part of teacher name (>=60%)
    if (parsed.academicYear && 
        parsed.branch &&
        parsed.teacherName &&
        bestMatch.library.name.startsWith(parsed.academicYear) && 
        bestMatch.library.name.includes(parsed.branch) &&
        bestMatch.confidence >= 60) {
      return true;
    }

    // Rule 3: Improved handling of SCI/AR confusion cases
    if (parsed.academicYear) {
      // Check for both SCI and AR in filename
      const hasSciAr = parsed.filename?.match(/SCI.*AR|AR.*SCI/i);
      
      if (hasSciAr && bestMatch.confidence >= 55) {
        const libNameLower = bestMatch.library.name.toLowerCase();
        
        // Match if the library contains either SCI or AR 
        if ((libNameLower.includes('-sci-') || libNameLower.includes('-ar-')) && 
            bestMatch.library.name.startsWith(parsed.academicYear)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Generate a pattern key from filename for caching
   */
  private getFilePatternKey(filename: string): string {
    try {
      const parsed = parseFilename(filename);
      if (!parsed) return filename.split(/[_\-]/)[0];
      
      const keyParts = [];
      
      if (parsed.academicYear) keyParts.push(parsed.academicYear);
      if (parsed.branch) keyParts.push(parsed.branch);
      if (parsed.teacherCode) keyParts.push(parsed.teacherCode);
      
      // If we have a teacher name but no code, include first part of teacher name
      if (!parsed.teacherCode && parsed.teacherName) {
        const firstNamePart = parsed.teacherName.split(' ')[0];
        if (firstNamePart) keyParts.push(firstNamePart.toLowerCase());
      }
      
      return keyParts.join('-');
    } catch (e) {
      return filename.split(/[_\-]/)[0]; // Fallback to just first part
    }
  }

  /**
   * Enhanced teacher name normalization for better matching
   */
  private normalizeTeacherName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '')  // Remove all whitespace
      .replace(/[^\p{L}\p{N}]/gu, '') // Remove non-alphanumeric chars (Unicode aware)
      .replace(/^(el|al)/, ''); // Remove common Arabic name prefixes
  }
  
  /**
   * Improved algorithm to find best matching library
   */
  private async findBestMatch(parsed: any, filename: string, libraries: LibraryDataInfo[]): Promise<LibraryMatch | null> {
    if (!libraries?.length) return null;
    
    const matches: Array<{ library: LibraryInfo; score: number; }> = [];
    
    const filenameInspection = {
      hasMultipleSubjects: filename.match(/SCI.*AR|AR.*SCI|EN.*AR|AR.*EN/i) !== null,
      containsBoth: (subject1: string, subject2: string) => {
        return filename.toLowerCase().includes(subject1.toLowerCase()) && 
               filename.toLowerCase().includes(subject2.toLowerCase());
      },
      // Extract teacher name from filename more aggressively
      getTeacherNameFromFilename: () => {
        // Try to extract name from Arabic section if exists
        if (parsed.arabicText) return ''; // Not using Arabic text for now
        
        // Extract name after P-code
        const teacherNameMatch = filename.match(/P\d{4}[_\-\s]+([A-Za-z\s]+)/);
        if (teacherNameMatch && teacherNameMatch[1]) {
          return teacherNameMatch[1].trim();
        }
        
        // Last resort - try last segments after excluding metadata parts
        const parts = filename.split(/[-_]/);
        for (let i = parts.length - 1; i >= 0; i--) {
          const part = parts[i];
          if (!/[TULQCtulqc]\d+|\{|\.mp4/i.test(part) && /[A-Za-z]/i.test(part)) {
            return part.trim();
          }
        }
        
        return '';
      }
    };
    
    let extractedName = parsed.teacherName || filenameInspection.getTeacherNameFromFilename();
    
    for (const library of libraries) {
      // Initialize score to 0
      let score = 0;
      const libNameLower = library.name.toLowerCase();
      
      // ENHANCED SCORING SYSTEM
      
      // 1. TEACHER CODE MATCH (highest weight - 60 points)
      if (parsed.teacherCode) {
        if (libNameLower.includes(parsed.teacherCode.toLowerCase())) {
          score += 60;
          
          // Bonus if position of teacher code matches the expected position in library name
          const libParts = library.name.split('-');
          const tcIndex = libParts.findIndex(part => 
            part.toLowerCase() === parsed.teacherCode.toLowerCase());
          if (tcIndex >= 2) score += 5; // Position bonus
          
          // Extra bonus if teacher code is exactly at position 3 (most common)
          if (tcIndex === 2) score += 5;
        }
      }
      
      // 2. ACADEMIC YEAR/LEVEL MATCH (high weight - 40 points)
      if (parsed.academicYear) {
        if (libNameLower.startsWith(parsed.academicYear.toLowerCase())) {
          score += 40; // Perfect match at start
        } else if (libNameLower.includes(`-${parsed.academicYear.toLowerCase()}-`)) {
          score += 30; // Found elsewhere
        } else if (libNameLower.includes(parsed.academicYear.toLowerCase())) {
          score += 20; // Found but not as separate part
        }
      }
      
      // 3. BRANCH MATCH WITH SPECIAL HANDLING FOR CONFLICTS
      if (parsed.branch) {
        const branchLower = parsed.branch.toLowerCase();
        
        // Check if filename has multiple subject indicators (like SCI-AR)
        if (filenameInspection.hasMultipleSubjects) {
          // Give points if library matches ANY of the possible subjects
          if (libNameLower.includes(`-${branchLower}-`) || 
              (branchLower === 'sci' && libNameLower.includes('-ar-')) ||
              (branchLower === 'ar' && libNameLower.includes('-sci-'))) {
            score += 25; // Reduced from 30 due to ambiguity
          }
        } else {
          // Standard branch matching
          if (libNameLower.includes(`-${branchLower}-`)) {
            score += 30; // Perfect match as section
          } else if (libNameLower.includes(branchLower)) {
            score += 20; // Partial match
          } 
          // Special case: Common AR/SCI confusion (enhance matching for this case)
          else if ((branchLower === 'sci' && libNameLower.includes('-ar-')) || 
                   (branchLower === 'ar' && libNameLower.includes('-sci-'))) {
            score += 15; // Give partial credit for this common substitution
          }
        }
      }
      
      // 4. TEACHER NAME MATCH (with better fuzzy matching)
      if (extractedName) {
        // Clean up and normalize the teacher name
        const fileTeacherName = this.normalizeTeacherName(extractedName);
        const libTeacherName = this.extractTeacherNameFromLibrary(library.name);
        
        if (libTeacherName && fileTeacherName && fileTeacherName.length >= 3) {
          if (libTeacherName === fileTeacherName) {
            score += 35; // Exact match (increased from 30)
          } else if (libTeacherName.startsWith(fileTeacherName) || fileTeacherName.startsWith(libTeacherName)) {
            score += 30; // One is prefix of the other (increased from 25)
          } else if (this.calculateNameSimilarity(libTeacherName, fileTeacherName) > 0.8) {
            score += 25; // Very high similarity
          } else if (this.calculateNameSimilarity(libTeacherName, fileTeacherName) > 0.6) {
            score += 15; // Good similarity
          } else if (this.calculateNameSimilarity(libTeacherName, fileTeacherName) > 0.4) {
            score += 10; // Some similarity
          }
        }
      }
      
      // 5. PARTS ORDER MATCH (lower weight - 15 points)
      if (this.checkPartsOrder(parsed)) {
        score += 15;
      }
      
      // Add to matches if score is non-zero
      if (score > 0) {
        matches.push({ library, score });
      }
    }
    
    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);
    
    // Return the best match (or null if none)
    if (matches.length === 0) return null;
    
    return {
      library: matches[0].library,
      confidence: Math.min(100, matches[0].score), // Cap at 100
      alternatives: matches.slice(0, 7).map(m => m.library) // Return top 7 alternatives
    };
  }

  /**
   * Get all available libraries
   */
  private async getLibraries(): Promise<LibraryDataInfo[]> {
    const data = await dataStorage.getLibraryData();
    if (!data?.libraries) return [];
    return data.libraries;
  }

  /**
   * Get list of suggested libraries based on parsed metadata and matching rules
   */
  private getSuggestedLibraries(parsed: any, libraries: LibraryDataInfo[], currentLibraryId?: string): Array<{ id: string; name: string; score?: number }> {
    const suggestions: Array<{ id: string; name: string; score?: number }> = [];
    const seen = new Set<string>();

    // Add current library first if exists
    if (currentLibraryId) {
      const currentLib = libraries.find(lib => lib.id === currentLibraryId);
      if (currentLib) {
        suggestions.push({
          id: currentLib.id,
          name: currentLib.name,
          score: 100
        });
        seen.add(currentLib.id);
      }
    }

    // Add suggested libraries from best match logic
    libraries.forEach(lib => {
      if (!seen.has(lib.id)) {
        const score = this.calculateMatchScore(lib.name, parsed);
        if (score > 30) { // Only include libraries with decent match score
          suggestions.push({
            id: lib.id,
            name: lib.name,
            score
          });
          seen.add(lib.id);
        }
      }
    });

    // Sort by score descending and limit to top 5
    return suggestions
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5);
  }

  /**
   * Calculate match score between library name and parsed filename
   */
  private calculateMatchScore(libraryName: string, parsed: any): number {
    let score = 0;
    const normalizedLibName = libraryName.toLowerCase();

    if (parsed.academicYear && normalizedLibName.includes(parsed.academicYear.toLowerCase())) score += 30;
    if (parsed.teacherCode && normalizedLibName.includes(parsed.teacherCode.toLowerCase())) score += 40;
    if (parsed.teacherName) {
      const nameParts = parsed.teacherName.toLowerCase().split(' ');
      for (const part of nameParts) {
        if (part.length > 2 && normalizedLibName.includes(part)) score += 15;
      }
    }
    if (parsed.branch && normalizedLibName.includes(parsed.branch.toLowerCase())) score += 15;

    return Math.min(score, 100);
  }

  /**
   * Extract teacher name from library name using common patterns
   */
  private extractTeacherNameFromLibrary(name: string): string {
    // Remove year and common prefixes
    const cleaned = name.replace(/^[SM][1-6]-/, '')
                      .replace(/^(SCI|AR|EN|MATH)-/, '')
                      .replace(/^P\d{4}-/, '');
    
    // Return first word-like segment that's not a known code/prefix
    const parts = cleaned.split(/[-_]/);
    return parts.find(p => /^[A-Za-z]{3,}$/.test(p)) || '';
  }

  /**
   * Calculate similarity between two strings
   */
  private calculateNameSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    const a = str1.toLowerCase();
    const b = str2.toLowerCase();
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;
    return (longerLength - this.editDistance(longer, shorter)) / longerLength;
  }

  /**
   * Edit distance calculation for similarity
   */
  private editDistance(s1: string, s2: string): number {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) costs[j] = j;
        else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  /**
   * Learns from manual library selections to improve future matching.
   */
  learnFromManualSelection(filename: string, libraryId: string, libraryName: string): void {
    const keywords = filename.split(/[\s\-_]+/).filter(word => word.length > 2 && isNaN(Number(word)));
    const key = keywords.join('|').toLowerCase();

    if (key && !this.manualMappings.has(key)) {
      console.log(`Learning: Mapping keywords "${key}" from "${filename}" to Library "${libraryName}" (${libraryId})`);
      this.manualMappings.set(key, { libraryId, libraryName });
      this.saveManualMappings();
    }
  }

  /**
   * Saves the learned manual mappings to local storage.
   */
  private saveManualMappings(): void {
    try {
      const mappingsArray = Array.from(this.manualMappings.entries());
      localStorage.setItem('manualLibraryMappings', JSON.stringify(mappingsArray));
    } catch (error) {
      console.error("Error saving manual mappings to local storage:", error);
    }
  }

  /**
   * Loads learned manual mappings from local storage.
   */
  private loadManualMappings(): void {
    try {
      const savedMappings = localStorage.getItem('manualLibraryMappings');
      if (savedMappings) {
        const mappingsArray = JSON.parse(savedMappings);
        this.manualMappings = new Map(mappingsArray);
        console.log(`Loaded ${this.manualMappings.size} manual library mappings.`);
      }
    } catch (error) {
      console.error("Error loading manual mappings from local storage:", error);
      this.manualMappings = new Map();
    }
  }

  /**
   * Determines a suggested library name based on filename parsing.
   */
  private determineSuggestedLibraryName(filename: string, year: string): string {
    try {
      const parsed = parseFilename(filename);
      return determineLibrary(parsed || { type: 'FULL', academicYear: year });
    } catch (error) {
      console.warn(`Error determining suggested library name for ${filename}:`, error);
      return "Unknown Library";
    }
  }

  /**
   * Checks if the parsed filename parts are in a logical order.
   */
  private checkPartsOrder(parsed: any): boolean {
    if (!parsed) return true;
    return true;
  }
}