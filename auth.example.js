// Uncomment any option that you require.
// All pre-uncommented options are required.

module.exports = {
  // Archived backup's name
  // name: 'goldenEye',

  // Discord Bot credentials
  discord: {
    token: 'mytalken',
    // While this is available, uploading backups to Discord might be not safe.
    // channel: '8chan'
  },

  // Cloud Storage credentials
  /* cloud: {
    provider: 'google-cloud-storage',
    credentials: {
      // For connection to the cloud storage
      // Get the available options at https://github.com/ItalyPaleAle/SMCloudStore
    },
    // Also known as bucket in some providers
    container: {
      name: 'myContainer',
      options: {
        region: 'us-west-1' // Only when provider requires it for container creation.
        class: 'coldline' // Google Cloud option
      }
    }
  }, */

  // MySQL / MariaDB credentials
  /* mysql: {
    dbs: [ 'furry' ],
    user: 'deadoralive',
    pass: 'likearecordbaby'
  }, */

  // NGINX Config
  // nginxPath: '/etc/nginx'
}
