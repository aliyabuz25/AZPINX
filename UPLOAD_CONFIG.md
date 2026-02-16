# AZPINX Upload Configuration

## File Upload Limits

This application supports unlimited file uploads with the following configurations:

### Express/Node.js Configuration
- **Multer**: No file size or count limits (`fileSize: Infinity, files: Infinity`)
- **Body Parser**: 100MB limit for URL-encoded and JSON payloads
- **Express JSON**: 100MB limit

### Reverse Proxy Configuration

#### Traefik
Traefik is configured in `docker-compose.yml` with standard settings. No additional middleware needed for file uploads.

#### Nginx (if used)
If you're using Nginx as a reverse proxy, use the provided `nginx.conf` configuration:
- `client_max_body_size 100M`
- `client_body_buffer_size 100M`
- `proxy_request_buffering off`

### Troubleshooting Upload Issues

If you experience upload failures:

1. **Check Docker volumes**: Ensure upload directories are properly mounted
   ```bash
   docker-compose down
   docker-compose up -d
   ```

2. **Check file permissions**: Upload directories must be writable
   ```bash
   chmod -R 755 public/uploads/
   ```

3. **Check Traefik logs**: Look for request size errors
   ```bash
   docker logs traefik
   ```

4. **Test locally**: Try uploading without Traefik
   ```bash
   curl -X POST -F "image=@test.jpg" http://localhost:3000/admin/sliders/create
   ```

### Supported Upload Types

- **Receipts**: `/uploads/receipts/` - No limit
- **Products**: `/uploads/products/` - No limit
- **Categories**: `/uploads/categories/` - No limit
- **Sliders**: `/uploads/sliders/` - No limit (Recommended: 1920x280px)

### Production Recommendations

While the application supports unlimited uploads, consider these best practices:

1. **Image optimization**: Compress images before upload
2. **File validation**: Validate file types on client-side
3. **Storage monitoring**: Monitor disk space usage
4. **CDN integration**: Consider using a CDN for large files
