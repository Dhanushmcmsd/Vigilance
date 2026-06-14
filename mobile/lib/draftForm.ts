export interface DraftItemAttachment {
  uri: string;
  name: string;
  type: 'image' | 'document';
  uploading?: boolean;
  fileUrl?: string;
}

export interface DraftForm {
  branchId: string;
  branchName: string;
  branchType: string;
  date: string;
  timeIn: string;
  timeOut: string;
  responses: Record<
    string,
    { response: 'Yes' | 'No' | 'N/A' | 'Good' | 'Moderate' | 'Bad' | null; remark: string }
  >;
  generalRemark: string;
  /** @deprecated Legacy flat file list — use itemFiles */
  fileUris?: string[];
  itemFiles?: Record<string, DraftItemAttachment[]>;
  savedAt: string;
  officerLat: number | null;
  officerLon: number | null;
  previousRiskItemIds?: string[];
}
