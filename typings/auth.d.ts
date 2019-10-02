export interface Auth {
  /** Archived backup's name */
  name?: string;

  /** Discord Bot credentials */
  discord: {
    token: string;
    channel?: string;
  };

  /** Cloud Storage credentials */
  cloud?: {
    provider: 'aws-s3' | 'azure-storage' | 'backblaze-b2' | 'generic-s3' | 'google-cloud-storage' | 'minio';
    credentials: any;
    container: {
      name: string;
      options?: {
        region?: string;
        class?: string;
      };
    }
  };

  /** MySQL / MariaDB credentials */
  mysql?: {
    dbs: string[];
    user: string;
    pass?: string;
  },

  // NGINX Config
  nginxPath?: string;
}
