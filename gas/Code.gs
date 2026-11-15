/* LEGACY REFERENCE ONLY — DO NOT DEPLOY.
 * Broker2Broker now uses Supabase PostgreSQL and private Supabase Storage through Next.js.
 * This old Apps Script source is retained only to preserve historical business-rule context.
 */
const B2B = Object.freeze({ NAME: 'Broker2Broker', DB_NAME: 'Broker2Broker Database', VERSION: '1.0.0' });
const SCHEMAS = {
  Users: ['userID','fullName','mobile','email','passwordHash','passwordSalt','agencyName','whatsappNumber','city','preferredLocalitiesJson','role','accountStatus','membershipStatus','currentPlan','membershipStartAt','membershipExpiresAt','createdAt','updatedAt','lastLoginAt','passwordResetHash','passwordResetExpiresAt'],
  BrokerProfiles: ['profileID','userID','bio','languagesJson','specialtiesJson','isVerified','verifiedBy','verifiedAt','createdAt','updatedAt'],
  Listings: ['listingID','ownerID','title','transactionType','propertyType','bhk','city','locality','landmark','carpetArea','builtUpArea','furnishing','floor','amenitiesJson','price','rent','deposit','availability','tenantPreference','contactNumbersJson','description','originalText','imagesJson','status','availabilityConfirmedAt','reconfirmDueAt','createdAt','updatedAt'],
  Subscriptions: ['subscriptionID','userID','paymentRequestID','paymentID','plan','amount','durationDays','status','startsAt','expiresAt','approvedBy','renewalType','createdAt'],
  PaymentRequests: ['requestID','userID','fullName','mobile','email','agencyName','subscriptionPlan','amount','upiTransactionID','paymentDate','requestDate','status','adminNotes','approvedBy','approvalDate','reviewedBy','reviewedAt','screenshotFileID','durationDays','whatsappNumber','createdAt','updatedAt'],
  Payments: ['paymentID','requestID','userID','plan','amount','upiTransactionID','paymentDate','status','verifiedBy','verifiedAt','createdAt'],
  Categories: ['categoryID','name','parentID','kind','active','sortOrder','createdAt','updatedAt'],
  Localities: ['localityID','city','name','state','active','createdAt','updatedAt'],
  Favourites: ['favouriteID','userID','listingID','createdAt'],
  Reports: ['reportID','listingID','reporterID','reason','details','status','adminNotes','reviewedBy','reviewedAt','createdAt'],
  Notifications: ['notificationID','userID','type','title','body','relatedID','readAt','createdAt'],
  Admins: ['adminID','userID','email','status','createdAt','updatedAt'],
  Developer: ['developerID','userID','email','status','createdAt'],
  Settings: ['settingID','key','value','valueType','isPublic','updatedBy','updatedAt'],
  AuditLogs: ['auditID','actorID','action','entityType','entityID','detailsJson','createdAt'],
  SecurityLogs: ['securityLogID','actorID','eventType','subject','ipHash','userAgent','detailsJson','createdAt'],
  FileAssets: ['fileID','ownerID','purpose','relatedID','driveFileID','fileName','mimeType','sizeBytes','active','createdAt']
};
const FOLDER_NAMES = ['Payment Screenshots','Listing Images','Database Backups','Export Reports','Platform Assets'];
const DEFAULT_CATEGORIES = [
  ['RES-1RK','1RK','RESIDENTIAL','PROPERTY',10],['RES-1BHK','1BHK','RESIDENTIAL','PROPERTY',20],['RES-2BHK','2BHK','RESIDENTIAL','PROPERTY',30],['RES-3BHK','3BHK','RESIDENTIAL','PROPERTY',40],['RES-4BHK','4BHK','RESIDENTIAL','PROPERTY',50],['RES-5BHK','5BHK+','RESIDENTIAL','PROPERTY',60],['RES-STUDIO','Studio','RESIDENTIAL','PROPERTY',70],['RES-DUPLEX','Duplex','RESIDENTIAL','PROPERTY',80],['RES-PENTHOUSE','Penthouse','RESIDENTIAL','PROPERTY',90],['RES-BUNGALOW','Bungalow','RESIDENTIAL','PROPERTY',100],['RES-VILLA','Villa','RESIDENTIAL','PROPERTY',110],['RES-ROWHOUSE','Row House','RESIDENTIAL','PROPERTY',120],
  ['COM-SHOP','Shop','COMMERCIAL','PROPERTY',200],['COM-OFFICE','Office','COMMERCIAL','PROPERTY',210],['COM-SHOWROOM','Showroom','COMMERCIAL','PROPERTY',220],['COM-WAREHOUSE','Warehouse','COMMERCIAL','PROPERTY',230],['COM-GODOWN','Godown','COMMERCIAL','PROPERTY',240],['COM-INDUSTRIAL','Industrial Unit','COMMERCIAL','PROPERTY',250],['COM-BUILDING','Commercial Building','COMMERCIAL','PROPERTY',260],
  ['OTH-PLOT','Plot','OTHER','PROPERTY',300],['OTH-LAND','Land','OTHER','PROPERTY',310],['OTH-PG','PG','OTHER','PROPERTY',320],['OTH-HOSTEL','Hostel','OTHER','PROPERTY',330],['OTH-COLIVING','Co-living','OTHER','PROPERTY',340],
  ['TX-RENT','Rent','','TRANSACTION',10],['TX-SALE','Sale','','TRANSACTION',20],['TX-RESALE','Resale','','TRANSACTION',30],['TX-HEAVY-DEPOSIT','Heavy Deposit','','TRANSACTION',40],['TX-LEASE','Lease','','TRANSACTION',50],['TX-COMM-RENT','Commercial Rent','','TRANSACTION',60],['TX-COMM-SALE','Commercial Sale','','TRANSACTION',70]
];
const DEFAULT_LOCALITIES = ['Mira Road','Bhayandar','Naya Nagar','Shivar Garden','Kanakia','Dahisar','Borivali','Kandivali','Malad','Goregaon','Andheri','Vasai','Virar','Naigaon'];

function setupBroker2Broker() {
    const props = PropertiesService.getScriptProperties();
    let ss = null;
    const existingId = props.getProperty('SPREADSHEET_ID');
    if (existingId) { try { ss = SpreadsheetApp.openById(existingId); } catch (ignore) {} }
    if (!ss) {
      const files = DriveApp.getFilesByName(B2B.DB_NAME);
      if (files.hasNext()) { const file = files.next(); ss = SpreadsheetApp.openById(file.getId()); }
      else ss = SpreadsheetApp.create(B2B.DB_NAME);
      props.setProperty('SPREADSHEET_ID', ss.getId());
    }
    let root = null;
    const rootId = props.getProperty('DRIVE_ROOT_ID');
    if (rootId) { try { root = DriveApp.getFolderById(rootId); } catch (ignore2) {} }
    if (!root) {
      const roots = DriveApp.getFoldersByName(B2B.NAME);
      root = roots.hasNext() ? roots.next() : DriveApp.createFolder(B2B.NAME);
      props.setProperty('DRIVE_ROOT_ID', root.getId());
    }
    const dbFile = DriveApp.getFileById(ss.getId());
    try { dbFile.moveTo(root); } catch (ignore3) {}
    const folderIds = {};
    FOLDER_NAMES.forEach(function(name) {
      let folder = null;
      const saved = props.getProperty('FOLDER_' + name.toUpperCase().replace(/[^A-Z0-9]+/g,'_'));
      if (saved) { try { folder = DriveApp.getFolderById(saved); } catch (ignore4) {} }
      if (!folder) {
        const children = root.getFoldersByName(name);
        folder = children.hasNext() ? children.next() : root.createFolder(name);
        props.setProperty('FOLDER_' + name.toUpperCase().replace(/[^A-Z0-9]+/g,'_'), folder.getId());
      }
      folderIds[name] = folder.getId();
    });
    Object.keys(SCHEMAS).forEach(function(sheetName) { ensureSheet_(ss, sheetName, SCHEMAS[sheetName]); });
    const defaultSheet = ss.getSheetByName('Sheet1');
    if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) ss.deleteSheet(defaultSheet);
    seedCategories_(); seedLocalities_(); seedSettings_(); installScheduledBackups_();
    return { spreadsheetId: ss.getId(), spreadsheetName: ss.getName(), driveFolderId: root.getId(), childFolders: folderIds, sheets: Object.keys(SCHEMAS), backupsScheduled: true };
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) { sheet.getRange(1,1,1,headers.length).setValues([headers]); sheet.setFrozenRows(1); return; }
  const existing = sheet.getRange(1,1,1,Math.max(1,sheet.getLastColumn())).getDisplayValues()[0].filter(String);
  headers.forEach(function(header) { if (existing.indexOf(header) < 0) { sheet.getRange(1,sheet.getLastColumn()+1).setValue(header); existing.push(header); } });
  sheet.setFrozenRows(1);
}
function installScheduledBackups_() {
  const triggers=ScriptApp.getProjectTriggers().map(function(t){return t.getHandlerFunction();});
  if (triggers.indexOf('scheduledDatabaseBackup')<0) ScriptApp.newTrigger('scheduledDatabaseBackup').timeBased().everyDays(1).atHour(2).create();
  if (triggers.indexOf('scheduledListingReconfirmation')<0) ScriptApp.newTrigger('scheduledListingReconfirmation').timeBased().everyDays(1).atHour(3).create();
}
function issueDeveloperBootstrapToken() {
  const token = Utilities.getUuid() + '-' + Utilities.getUuid() + '-' + Utilities.getUuid();
  const hash = sha256Hex_(token);
  PropertiesService.getScriptProperties().setProperty('DEVELOPER_BOOTSTRAP_HASH', hash);
  Logger.log('One-time Broker2Broker developer bootstrap token (copy it now; it will not be shown again): ' + token);
  return 'A one-time token was written to the Apps Script execution log. Keep it private and use it once at /developer-control.';
}

function doGet() { return jsonOutput_({ ok: false, error: { code: 'POST_REQUIRED', message: 'Use the authenticated application API.' } }); }
function doPost(e) {
  try {
    const request = JSON.parse(e && e.postData && e.postData.contents || '{}');
    verifySignedRequest_(request);
    const payloadText = Utilities.newBlob(Utilities.base64Decode(request.payloadB64)).getDataAsString('UTF-8');
    const data = JSON.parse(payloadText || '{}');
    rateLimit_(request.action, data);
    const result = dispatch_(request.action, data);
    return jsonOutput_({ ok: true, data: result });
  } catch (err) {
    const code = err && err.code ? err.code : 'BACKEND_ERROR';
    const message = err && err.message ? String(err.message).slice(0,500) : 'The backend could not complete the request.';
    return jsonOutput_({ ok: false, error: { code: code, message: message } });
  }
}
function jsonOutput_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function verifySignedRequest_(req) {
  const props = PropertiesService.getScriptProperties();
  const secret = props.getProperty('GAS_HMAC_SECRET');
  if (!secret || secret.length < 32) fail_('BACKEND_NOT_CONFIGURED','GAS_HMAC_SECRET is not configured in Apps Script Project Properties.');
  if (!req || !req.action || !req.timestamp || !req.nonce || !req.payloadB64 || !req.signature) fail_('INVALID_INPUT','Signed request is incomplete.');
  const timestamp = Number(req.timestamp);
  if (!isFinite(timestamp) || Math.abs(Date.now()-timestamp) > 5*60*1000) fail_('INVALID_SIGNATURE','Request has expired.');
  const canonical = String(req.timestamp)+'.'+String(req.nonce)+'.'+String(req.action)+'.'+String(req.payloadB64);
  const expected = bytesToHex_(Utilities.computeHmacSha256Signature(canonical,secret,Utilities.Charset.UTF_8));
  if (!constantTimeEqual_(expected,String(req.signature).toLowerCase())) fail_('INVALID_SIGNATURE','Request signature is invalid.');
  const cache = CacheService.getScriptCache();
  const nonceKey = 'nonce:'+String(req.nonce).replace(/[^a-zA-Z0-9-]/g,'').slice(0,80);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try { if (cache.get(nonceKey)) fail_('REPLAYED_REQUEST','This signed request has already been used.'); cache.put(nonceKey,'1',600); }
  finally { lock.releaseLock(); }
}
function rateLimit_(action,data) {
  const limits = { 'auth.getByEmail':[12,600], 'auth.register':[6,3600], 'auth.reset.request':[4,3600], 'auth.reset.complete':[6,3600], 'auth.changePassword':[6,3600], 'ai.context':[12,60], 'payment.createRequest':[6,3600], 'listings.search':[60,60], 'files.upload':[12,3600] };
  const rule = limits[action] || [90,60];
  const subject = String(data.actorID || data.rateKey || data.email || 'server').toLowerCase().slice(0,120);
  const digest = sha256Hex_(subject).slice(0,32);
  const key = 'rate:'+action+':'+digest;
  const cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try { const count = Number(cache.get(key) || 0); if (count >= rule[0]) fail_('RATE_LIMITED','Too many requests. Please wait and try again.'); cache.put(key,String(count+1),rule[1]); }
  finally { lock.releaseLock(); }
}
function dispatch_(action,data) {
  switch (action) {
    case 'system.health': return developerHealth_(data);
    case 'developer.bootstrapStatus': return developerBootstrapStatus_();
    case 'developer.bootstrap': return developerBootstrap_(data);
    case 'auth.register': return registerUser_(data);
    case 'auth.getByEmail': return getAuthUserByEmail_(data);
    case 'auth.getById': return getUserById_(data);
    case 'auth.getOwnCredentials': return getOwnCredentials_(data);
    case 'auth.changePassword': return changePassword_(data);
    case 'auth.loginSuccess': return loginSuccess_(data);
    case 'auth.reset.request': return passwordResetRequest_(data);
    case 'auth.reset.complete': return passwordResetComplete_(data);
    case 'security.log': return recordSecurityEvent_(data);
    case 'settings.public': return publicSettings_();
    case 'settings.paymentPage': return memberPaymentSettings_(data);
    case 'settings.admin': return adminSettings_(data);
    case 'settings.updatePayment': return updatePaymentSettings_(data);
    case 'settings.ai': requireDeveloper_(String(data.actorID||'')); return aiSettings_();
    case 'settings.updateAI': return updateAISettings_(data);
    case 'settings.updateMaintenance': return updateMaintenance_(data);
    case 'user.updateProfile': return updateProfile_(data);
    case 'user.dashboard': return userDashboard_(data);
    case 'user.mySubscriptions': return mySubscriptions_(data);
    case 'user.notifications': return userNotifications_(data);
    case 'user.markNotification': return markNotification_(data);
    case 'payment.createRequest': return createPaymentRequest_(data);
    case 'payment.myRequests': return myPaymentRequests_(data);
    case 'admin.paymentRequests': return adminPaymentRequests_(data);
    case 'admin.paymentDecision': return paymentDecision_(data);
    case 'listings.create': return createListing_(data);
    case 'listings.search': return searchListings_(data);
    case 'listings.my': return myListings_(data);
    case 'listings.get': return getListing_(data);
    case 'listings.update': return updateListing_(data);
    case 'listings.delete': return deleteListing_(data);
    case 'listings.reconfirm': return reconfirmListing_(data);
    case 'admin.listings': return adminListings_(data);
    case 'admin.listingDecision': return adminListingDecision_(data);
    case 'categories.list': return listCategories_();
    case 'categories.save': return saveCategory_(data);
    case 'categories.delete': return deleteCategory_(data);
    case 'localities.list': return listLocalities_(data);
    case 'localities.save': return saveLocality_(data);
    case 'localities.delete': return deleteLocality_(data);
    case 'favourites.list': return listFavourites_(data);
    case 'favourites.add': return addFavourite_(data);
    case 'favourites.remove': return removeFavourite_(data);
    case 'reports.create': return createReport_(data);
    case 'admin.reports': return adminReports_(data);
    case 'admin.reportDecision': return reportDecision_(data);
    case 'admin.users': return adminUsers_(data);
    case 'admin.userAction': return adminUserAction_(data);
    case 'admin.announcement': return createAnnouncement_(data);
    case 'developer.userRole': return developerUserRole_(data);
    case 'developer.analytics': return developerAnalytics_(data);
    case 'developer.securityLogs': return developerSecurityLogs_(data);
    case 'developer.exportData': return developerExportData_(data);
    case 'developer.backup': return createDatabaseBackup_(data.actorID || 'DEVELOPER');
    case 'developer.health': return developerHealth_(data);
    case 'files.upload': return uploadFile_(data);
    case 'files.get': return getFile_(data);
    case 'ai.context': return aiSettingsForMember_(data);
    default: fail_('NOT_FOUND','Unknown backend action.');
  }
}
function fail_(code,message) { const e = new Error(message); e.code = code; throw e; }
function withLock_(fn) { const lock=LockService.getScriptLock(); lock.waitLock(20000); try { return fn(); } finally { lock.releaseLock(); } }
function newId_(prefix) { return prefix+'-'+Utilities.getUuid().replace(/-/g,'').slice(0,16).toUpperCase(); }
function nowIso_() { return new Date().toISOString(); }
function isoPlusDays_(iso,days) { return new Date(new Date(iso).getTime()+Number(days)*86400000).toISOString(); }
function sha256Hex_(value) { return bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value),Utilities.Charset.UTF_8)); }
function bytesToHex_(bytes) { return bytes.map(function(b){const n=b<0?b+256:b;return ('0'+n.toString(16)).slice(-2);}).join(''); }
function constantTimeEqual_(a,b) { if (a.length!==b.length) return false; let v=0; for(let i=0;i<a.length;i++) v|=a.charCodeAt(i)^b.charCodeAt(i); return v===0; }
function getSpreadsheet_() { const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'); if(!id) fail_('BACKEND_NOT_CONFIGURED','Run setupBroker2Broker in Apps Script first.'); return SpreadsheetApp.openById(id); }
function getSheet_(name) { const s=getSpreadsheet_().getSheetByName(name); if(!s) fail_('BACKEND_NOT_CONFIGURED','Required sheet is missing: '+name+'. Run setupBroker2Broker.'); return s; }
function records_(name) {
  const sheet=getSheet_(name); const rows=sheet.getDataRange().getValues(); if(rows.length<2) return [];
  const headers=rows[0].map(String);
  return rows.slice(1).map(function(row,index){ const obj={_row:index+2}; headers.forEach(function(h,i){ obj[h]=row[i] instanceof Date ? row[i].toISOString() : row[i]; }); return obj; }).filter(function(r){return Object.keys(r).some(function(k){return k!=='_row' && r[k]!=='' && r[k]!==null;});});
}
function append_(name,record) {
  const sheet=getSheet_(name); const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const row=headers.map(function(h){ const v=record[h]; if(v===undefined || v===null) return ''; return Array.isArray(v)||typeof v==='object' ? JSON.stringify(v) : v; });
  sheet.appendRow(row);
}
function updateRow_(name,rowNum,patch) {
  const sheet=getSheet_(name); const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String); const row=sheet.getRange(rowNum,1,1,headers.length).getValues()[0];
  Object.keys(patch).forEach(function(key){const col=headers.indexOf(key); if(col>=0) row[col]=Array.isArray(patch[key])||typeof patch[key]==='object' ? JSON.stringify(patch[key]) : patch[key];});
  sheet.getRange(rowNum,1,1,headers.length).setValues([row]);
}
function by_(name,key,value) { const v=String(value||'').toLowerCase(); return records_(name).find(function(r){return String(r[key]||'').toLowerCase()===v;})||null; }
function rowsBy_(name,key,value) { const v=String(value||'').toLowerCase(); return records_(name).filter(function(r){return String(r[key]||'').toLowerCase()===v;}); }
function parseJson_(v,fallback) { try { return v ? JSON.parse(v) : fallback; } catch(ignore) { return fallback; } }
function recordUser_(r) {
  if(!r) return null;
  return { userID:String(r.userID), fullName:String(r.fullName||''), mobile:String(r.mobile||''), email:String(r.email||''), agencyName:String(r.agencyName||''), whatsappNumber:String(r.whatsappNumber||''), city:String(r.city||''), preferredLocalities:parseJson_(r.preferredLocalitiesJson,[]), role:String(r.role||'USER'), accountStatus:String(r.accountStatus||'ACTIVE'), membershipStatus:membershipStatus_(r), currentPlan:String(r.currentPlan||'FREE'), membershipStartAt:String(r.membershipStartAt||''), membershipExpiresAt:String(r.membershipExpiresAt||''), createdAt:String(r.createdAt||''), brokerProfile:brokerProfile_(String(r.userID)), maintenanceMode:settingValue_('platform.maintenanceMode','false')==='true' };
}
function brokerProfile_(userID) { const p=by_('BrokerProfiles','userID',userID); return p ? {profileID:p.profileID,bio:String(p.bio||''),languages:parseJson_(p.languagesJson,[]),specialties:parseJson_(p.specialtiesJson,[]),isVerified:String(p.isVerified)==='TRUE',verifiedAt:String(p.verifiedAt||'')} : null; }
function membershipStatus_(u) {
  if(String(u.accountStatus)==='SUSPENDED') return 'SUSPENDED';
  const expiry=Date.parse(String(u.membershipExpiresAt||''));
  if(String(u.membershipStatus)==='ACTIVE' && isFinite(expiry) && expiry>Date.now()) return 'ACTIVE';
  const reqs=rowsBy_('PaymentRequests','userID',String(u.userID)).sort(function(a,b){return String(b.requestDate).localeCompare(String(a.requestDate));});
  if(reqs.some(function(r){return r.status==='PENDING VERIFICATION'||r.status==='MORE INFO REQUIRED';})) return 'PAYMENT PENDING';
  if(reqs.length&&reqs[0].status==='REJECTED') return 'PAYMENT REJECTED';
  if(isFinite(expiry) && expiry>0 && expiry<=Date.now()) return 'EXPIRED';
  return 'FREE ACCOUNT';
}
function currentUser_(userID) { const r=by_('Users','userID',userID); if(!r) fail_('UNAUTHENTICATED','Account not found.'); return r; }
function publicUser_(r) { return recordUser_(r); }
function roleUser_(userID,roles) { const u=currentUser_(userID); if(String(u.accountStatus)!=='ACTIVE') fail_('FORBIDDEN','This account is not active.'); if(roles.indexOf(String(u.role))<0) fail_('FORBIDDEN','You do not have permission for this action.'); return u; }
function requireMember_(userID) { const u=roleUser_(userID,['USER','ADMIN','DEVELOPER']); if(String(u.accountStatus)!=='ACTIVE'||membershipStatus_(u)!=='ACTIVE') fail_('MEMBERSHIP_REQUIRED','An active approved membership is required.'); return u; }
function requireDeveloper_(userID) { const u=roleUser_(userID,['DEVELOPER']); const canonical=PropertiesService.getScriptProperties().getProperty('DEVELOPER_USER_ID'); if(!canonical||String(canonical)!==String(userID)) fail_('FORBIDDEN','Only the original developer account can access this function.'); return u; }
function requireAdmin_(userID) { return roleUser_(userID,['ADMIN','DEVELOPER']); }
function audit_(actor,action,type,entity,details) { append_('AuditLogs',{auditID:newId_('AUD'),actorID:actor||'SYSTEM',action:action,entityType:type,entityID:entity||'',detailsJson:JSON.stringify(details||{}),createdAt:nowIso_()}); }
function securityLog_(actor,event,subject,data) { append_('SecurityLogs',{securityLogID:newId_('SEC'),actorID:actor||'',eventType:event,subject:String(subject||'').slice(0,160),ipHash:String(data.ipHash||''),userAgent:String(data.userAgent||'').slice(0,300),detailsJson:JSON.stringify(data.details||{}),createdAt:nowIso_()}); }
function notify_(userID,type,title,body,relatedID) { append_('Notifications',{notificationID:newId_('NTF'),userID:userID,type:type,title:title,body:body,relatedID:relatedID||'',readAt:'',createdAt:nowIso_()}); }

function registerUser_(d) {
  const email=String(d.email||'').trim().toLowerCase(); if(!email||!/^\S+@\S+\.\S+$/.test(email)) fail_('INVALID_INPUT','Enter a valid email address.');
  if(!/^[a-f0-9]{32}$/i.test(String(d.passwordSalt||''))||!/^[a-f0-9]{128}$/i.test(String(d.passwordHash||''))) fail_('INVALID_INPUT','Password verifier is invalid.');
  return withLock_(function(){ if(by_('Users','email',email)) fail_('CONFLICT','An account already exists for this email.'); const now=nowIso_(); const id=newId_('USR');
    append_('Users',{userID:id,fullName:String(d.fullName||'').trim(),mobile:String(d.mobile||'').trim(),email:email,passwordHash:d.passwordHash,passwordSalt:d.passwordSalt,agencyName:String(d.agencyName||'').trim(),whatsappNumber:String(d.whatsappNumber||'').trim(),city:String(d.city||'').trim(),preferredLocalitiesJson:JSON.stringify(d.preferredLocalities||[]),role:'USER',accountStatus:'ACTIVE',membershipStatus:'FREE ACCOUNT',currentPlan:'FREE',membershipStartAt:'',membershipExpiresAt:'',createdAt:now,updatedAt:now,lastLoginAt:'',passwordResetHash:'',passwordResetExpiresAt:''});
    append_('BrokerProfiles',{profileID:newId_('BPF'),userID:id,bio:'',languagesJson:'[]',specialtiesJson:'[]',isVerified:'FALSE',verifiedBy:'',verifiedAt:'',createdAt:now,updatedAt:now});
    audit_(id,'USER_REGISTERED','USER',id,{email:email}); return publicUser_(by_('Users','userID',id)); });
}
function getAuthUserByEmail_(d) { const u=by_('Users','email',String(d.email||'').trim().toLowerCase()); if(!u) return null; return {userID:String(u.userID),email:String(u.email),passwordHash:String(u.passwordHash),passwordSalt:String(u.passwordSalt),role:String(u.role),accountStatus:String(u.accountStatus)}; }
function getUserById_(d) { const u=by_('Users','userID',String(d.userID||'')); return u ? publicUser_(u) : null; }
function loginSuccess_(d) { return withLock_(function(){ const u=currentUser_(String(d.userID||'')); updateRow_('Users',u._row,{lastLoginAt:nowIso_(),updatedAt:nowIso_()}); return publicUser_(by_('Users','userID',String(d.userID))); }); }
function developerBootstrapStatus_() { const dev=records_('Developer').some(function(r){return r.status==='ACTIVE';}); return {exists:dev,setupAvailable:!!PropertiesService.getScriptProperties().getProperty('DEVELOPER_BOOTSTRAP_HASH')&&!dev}; }
function developerBootstrap_(d) {
  const props=PropertiesService.getScriptProperties(); const expected=props.getProperty('DEVELOPER_BOOTSTRAP_HASH');
  if(!expected||!constantTimeEqual_(expected,sha256Hex_(String(d.bootstrapToken||'')))) fail_('FORBIDDEN','The one-time developer setup token is invalid or expired.');
  if(!d.email||!/^\S+@\S+\.\S+$/.test(String(d.email))||!/^[a-f0-9]{32}$/i.test(String(d.passwordSalt||''))||!/^[a-f0-9]{128}$/i.test(String(d.passwordHash||''))) fail_('INVALID_INPUT','Developer account details are invalid.');
  return withLock_(function(){ if(records_('Developer').some(function(r){return r.status==='ACTIVE';})) fail_('CONFLICT','A developer account has already been created.'); if(by_('Users','email',String(d.email).toLowerCase())) fail_('CONFLICT','An account already exists for this email.');
    const now=nowIso_(); const id=newId_('USR'); append_('Users',{userID:id,fullName:String(d.fullName||'').trim(),mobile:String(d.mobile||''),email:String(d.email).toLowerCase(),passwordHash:d.passwordHash,passwordSalt:d.passwordSalt,agencyName:'Broker2Broker Platform',whatsappNumber:String(d.mobile||''),city:'India',preferredLocalitiesJson:'[]',role:'DEVELOPER',accountStatus:'ACTIVE',membershipStatus:'FREE ACCOUNT',currentPlan:'FREE',membershipStartAt:'',membershipExpiresAt:'',createdAt:now,updatedAt:now,lastLoginAt:'',passwordResetHash:'',passwordResetExpiresAt:''});
    append_('BrokerProfiles',{profileID:newId_('BPF'),userID:id,bio:'Platform developer',languagesJson:'[]',specialtiesJson:'[]',isVerified:'TRUE',verifiedBy:id,verifiedAt:now,createdAt:now,updatedAt:now}); append_('Developer',{developerID:newId_('DEV'),userID:id,email:String(d.email).toLowerCase(),status:'ACTIVE',createdAt:now});
    props.setProperty('DEVELOPER_USER_ID',id); props.deleteProperty('DEVELOPER_BOOTSTRAP_HASH'); audit_(id,'DEVELOPER_BOOTSTRAPPED','DEVELOPER',id,{email:String(d.email).toLowerCase()}); return publicUser_(by_('Users','userID',id)); });
}

function passwordResetRequest_(d) {
  const email=String(d.email||'').trim().toLowerCase(); const u=by_('Users','email',email); if(!u) return {sent:true};
  const token=String(d.token||''); const resetUrl=String(d.resetUrl||''); if(token.length<24||!/^https:\/\//.test(resetUrl)) fail_('INVALID_INPUT','Reset link is not configured.');
  return withLock_(function(){ updateRow_('Users',u._row,{passwordResetHash:sha256Hex_(token),passwordResetExpiresAt:new Date(Date.now()+30*60*1000).toISOString(),updatedAt:nowIso_()});
    try { MailApp.sendEmail({to:email,subject:'Reset your Broker2Broker password',body:'Use this one-time link to reset your password (valid for 30 minutes):\n\n'+resetUrl+'\n\nIf you did not request this, you can ignore this email.'}); }
    catch(err) { updateRow_('Users',u._row,{passwordResetHash:'',passwordResetExpiresAt:'',updatedAt:nowIso_()}); fail_('EMAIL_NOT_CONFIGURED','Password reset email could not be sent. Authorize MailApp in Apps Script and check the project quotas.'); }
    securityLog_(u.userID,'PASSWORD_RESET_REQUESTED',email,d); return {sent:true}; });
}
function passwordResetComplete_(d) {
  const token=String(d.token||''); if(token.length<24||!/^[a-f0-9]{32}$/i.test(String(d.passwordSalt||''))||!/^[a-f0-9]{128}$/i.test(String(d.passwordHash||''))) fail_('INVALID_INPUT','Password reset details are invalid.');
  return withLock_(function(){ const hash=sha256Hex_(token); const u=records_('Users').find(function(r){return String(r.passwordResetHash||'')===hash&&Date.parse(String(r.passwordResetExpiresAt||''))>Date.now();}); if(!u) fail_('INVALID_TOKEN','This password reset link is invalid or expired.');
    updateRow_('Users',u._row,{passwordHash:d.passwordHash,passwordSalt:d.passwordSalt,passwordResetHash:'',passwordResetExpiresAt:'',updatedAt:nowIso_()}); audit_(u.userID,'PASSWORD_RESET','USER',u.userID,{}); securityLog_(u.userID,'PASSWORD_RESET_COMPLETED',u.email,d); return {completed:true}; });
}

function settingMap_() { const map={}; records_('Settings').forEach(function(r){map[String(r.key)]=String(r.value||'');}); return map; }
function settingValue_(key,fallback) { const m=settingMap_(); return Object.prototype.hasOwnProperty.call(m,key)?m[key]:fallback; }
function seedSettings_() {
  const defaults={
    'payment.upiId':['','string',true], 'payment.payeeName':['','string',true], 'payment.upiQrFileId':['','string',false], 'payment.whatsappNumber':['','string',true],
    'payment.monthlyPrice':['199','number',true], 'payment.yearlyPrice':['1999','number',true], 'payment.monthlyDurationDays':['30','number',true], 'payment.yearlyDurationDays':['365','number',true],
    'payment.instructions':['Scan the QR code or pay directly to the UPI ID shown above. After completing payment, submit your UTR and payment date for manual verification.','string',true],
    'payment.customerSupportMessage':['For payment questions, contact the support number shown here. Membership is activated only after an administrator verifies the UPI credit.','string',true],
    'support.email':['','string',true], 'support.hours':['','string',true],
    'platform.maintenanceMode':['false','boolean',false], 'ai.provider':['rule-based','string',false], 'ai.model':['','string',false]
  };
  withLock_(function(){ const current=records_('Settings'); const keys=current.map(function(r){return String(r.key);}); Object.keys(defaults).forEach(function(k){if(keys.indexOf(k)<0) append_('Settings',{settingID:newId_('SET'),key:k,value:defaults[k][0],valueType:defaults[k][1],isPublic:defaults[k][2]?'TRUE':'FALSE',updatedBy:'SYSTEM',updatedAt:nowIso_()});}); });
}
function seedCategories_() { withLock_(function(){ const present=records_('Categories').map(function(r){return String(r.categoryID);}); const now=nowIso_(); DEFAULT_CATEGORIES.forEach(function(a){if(present.indexOf(a[0])<0) append_('Categories',{categoryID:a[0],name:a[1],parentID:a[2],kind:a[3],active:'TRUE',sortOrder:a[4],createdAt:now,updatedAt:now});}); }); }
function seedLocalities_() { withLock_(function(){ const present=records_('Localities').map(function(r){return String(r.name).toLowerCase();}); const now=nowIso_(); DEFAULT_LOCALITIES.forEach(function(name){if(present.indexOf(name.toLowerCase())<0){const lower=name.toLowerCase();const city=['mira road','bhayandar','naya nagar','shivar garden','kanakia'].indexOf(lower)>=0?'Mira Bhayandar':['dahisar','borivali','kandivali','malad','goregaon','andheri'].indexOf(lower)>=0?'Mumbai':'Vasai-Virar';append_('Localities',{localityID:newId_('LOC'),city:city,name:name,state:'Maharashtra',active:'TRUE',createdAt:now,updatedAt:now});}}); }); }
function publicSettings_() { const s=settingMap_(); return { settings:{upiId:s['payment.upiId']||'',payeeName:s['payment.payeeName']||'',whatsappNumber:s['payment.whatsappNumber']||'',monthlyPrice:Number(s['payment.monthlyPrice']||199),yearlyPrice:Number(s['payment.yearlyPrice']||1999),monthlyDurationDays:Number(s['payment.monthlyDurationDays']||30),yearlyDurationDays:Number(s['payment.yearlyDurationDays']||365),paymentInstructions:s['payment.instructions']||'',customerSupportMessage:s['payment.customerSupportMessage']||'',supportEmail:s['support.email']||'',supportHours:s['support.hours']||'',maintenanceMode:s['platform.maintenanceMode']==='true'} }; }
function memberPaymentSettings_(d) { roleUser_(String(d.actorID||''),['USER','ADMIN','DEVELOPER']); const out=publicSettings_(); out.settings.upiQrFileId=settingValue_('payment.upiQrFileId',''); return out; }
function adminSettings_(d) { requireAdmin_(String(d.actorID||'')); const out=publicSettings_().settings; out.upiQrFileId=settingValue_('payment.upiQrFileId',''); return out; }
function updateSettings_(actorID,updates) {
  const sheet=getSheet_('Settings'); const rows=records_('Settings'); const now=nowIso_();
  Object.keys(updates).forEach(function(key){const existing=rows.find(function(r){return r.key===key;}); const value=String(updates[key]); if(existing) updateRow_('Settings',existing._row,{value:value,updatedBy:actorID,updatedAt:now}); else append_('Settings',{settingID:newId_('SET'),key:key,value:value,valueType:typeof updates[key]==='number'?'number':typeof updates[key]==='boolean'?'boolean':'string',isPublic:key.indexOf('payment.')===0?'TRUE':'FALSE',updatedBy:actorID,updatedAt:now}); });
  CacheService.getScriptCache().remove('public-settings');
}
function updatePaymentSettings_(d) {
  const actor=requireAdmin_(String(d.actorID||'')); const v=d.settings||{};
  if(String(v.upiId||'').length>120||String(v.payeeName||'').length>120||String(v.paymentInstructions||'').length>2000) fail_('INVALID_INPUT','Payment settings are too long.');
  const num=['monthlyPrice','yearlyPrice','monthlyDurationDays','yearlyDurationDays']; num.forEach(function(k){if(!isFinite(Number(v[k]))||Number(v[k])<1||Number(v[k])>1000000) fail_('INVALID_INPUT','Invalid setting: '+k);});
  const qrID=String(v.upiQrFileId||'').trim(); if(qrID){const qr=by_('FileAssets','fileID',qrID);if(!qr||qr.purpose!=='QR_CODE'||String(qr.active)!=='TRUE')fail_('INVALID_INPUT','Configured QR image reference is invalid.');}
  const whatsapp=String(v.whatsappNumber||'').trim(); if(whatsapp&&!/^\+?[0-9][0-9\s().-]{7,19}$/.test(whatsapp))fail_('INVALID_INPUT','Enter a valid WhatsApp contact number.');
  const updates={'payment.upiId':String(v.upiId||'').trim(),'payment.payeeName':String(v.payeeName||'').trim(),'payment.upiQrFileId':qrID,'payment.whatsappNumber':whatsapp,'payment.monthlyPrice':String(Math.round(Number(v.monthlyPrice))),'payment.yearlyPrice':String(Math.round(Number(v.yearlyPrice))),'payment.monthlyDurationDays':String(Math.round(Number(v.monthlyDurationDays))),'payment.yearlyDurationDays':String(Math.round(Number(v.yearlyDurationDays))),'payment.instructions':String(v.paymentInstructions||'').trim(),'payment.customerSupportMessage':String(v.customerSupportMessage||'').trim(),'support.email':String(v.supportEmail||'').trim(),'support.hours':String(v.supportHours||'').trim()};
  return withLock_(function(){ updateSettings_(String(actor.userID),updates); audit_(String(actor.userID),'PAYMENT_SETTINGS_UPDATED','SETTINGS','payment',updates); return publicSettings_().settings; });
}
function aiSettings_() { const s=settingMap_(); return {provider:s['ai.provider']||'rule-based',model:s['ai.model']||''}; }
function aiSettingsForMember_(d) { requireMember_(String(d.actorID||'')); return aiSettings_(); }
function updateAISettings_(d) {
  const actor=requireDeveloper_(String(d.actorID||'')); const provider=String(d.provider||'rule-based'); const model=String(d.model||'').trim();
  if(['rule-based','openai-compatible'].indexOf(provider)<0) fail_('INVALID_INPUT','Choose a supported AI mode.'); if(model.length>120) fail_('INVALID_INPUT','Model name is too long.');
  return withLock_(function(){ updateSettings_(String(actor.userID),{'ai.provider':provider,'ai.model':model}); audit_(actor.userID,'AI_SETTINGS_UPDATED','SETTINGS','ai',{provider:provider,model:model}); return aiSettings_(); });
}

function updateProfile_(d) {
  const actor=roleUser_(String(d.actorID||''),['USER','ADMIN','DEVELOPER']); const target=String(d.userID||'');
  if(target!==String(actor.userID)&&actor.role!=='ADMIN'&&actor.role!=='DEVELOPER') fail_('FORBIDDEN','You can only edit your own profile.');
  const u=currentUser_(target); const now=nowIso_();
  return withLock_(function(){ updateRow_('Users',u._row,{fullName:String(d.fullName||'').trim(),mobile:String(d.mobile||'').trim(),agencyName:String(d.agencyName||'').trim(),whatsappNumber:String(d.whatsappNumber||'').trim(),city:String(d.city||'').trim(),preferredLocalitiesJson:JSON.stringify(d.preferredLocalities||[]),updatedAt:now});
    const p=by_('BrokerProfiles','userID',target); if(p) updateRow_('BrokerProfiles',p._row,{bio:String(d.bio||'').trim(),languagesJson:JSON.stringify(d.languages||[]),specialtiesJson:JSON.stringify(d.specialties||[]),updatedAt:now});
    audit_(actor.userID,'PROFILE_UPDATED','USER',target,{}); return publicUser_(by_('Users','userID',target)); });
}
function userDashboard_(d) {
  const u=roleUser_(String(d.actorID||''),['USER','ADMIN','DEVELOPER']); const id=String(u.userID); const listings=rowsBy_('Listings','ownerID',id).filter(function(l){return l.status!=='DELETED';}); const requests=rowsBy_('PaymentRequests','userID',id).sort(function(a,b){return String(b.requestDate).localeCompare(String(a.requestDate));});
  const notifications=rowsBy_('Notifications','userID',id).filter(function(n){return !n.readAt;}).length; const status=membershipStatus_(u); const expiry=Date.parse(String(u.membershipExpiresAt||''));
  return {user:publicUser_(u),membership:{status:status,plan:String(u.currentPlan||'FREE'),startAt:String(u.membershipStartAt||''),expiresAt:String(u.membershipExpiresAt||''),daysRemaining:status==='ACTIVE'?Math.max(0,Math.ceil((expiry-Date.now())/86400000)):0},counts:{myListings:listings.length,activeListings:listings.filter(function(l){return l.status==='ACTIVE'&&Date.parse(String(l.reconfirmDueAt||''))>Date.now();}).length,savedProperties:rowsBy_('Favourites','userID',id).length,unreadNotifications:notifications},latestPaymentRequest:requests[0]?publicPaymentRequest_(requests[0]):null};
}
function mySubscriptions_(d) { const u=roleUser_(String(d.actorID||''),['USER','ADMIN','DEVELOPER']); return rowsBy_('Subscriptions','userID',String(u.userID)).sort(function(a,b){return String(b.createdAt).localeCompare(String(a.createdAt));}).map(function(r){return {subscriptionID:r.subscriptionID,plan:r.plan,amount:Number(r.amount),durationDays:Number(r.durationDays),status:r.status,startsAt:r.startsAt,expiresAt:r.expiresAt,paymentID:r.paymentID};}); }
function userNotifications_(d) { const u=roleUser_(String(d.actorID||''),['USER','ADMIN','DEVELOPER']); const p=Math.max(1,Number(d.page)||1),limit=Math.min(50,Math.max(1,Number(d.limit)||30)); const rows=rowsBy_('Notifications','userID',String(u.userID)).sort(function(a,b){return String(b.createdAt).localeCompare(String(a.createdAt));}); return {items:rows.slice((p-1)*limit,p*limit).map(function(n){return {notificationID:n.notificationID,type:n.type,title:n.title,body:n.body,relatedID:n.relatedID,readAt:n.readAt,createdAt:n.createdAt};}),total:rows.length,page:p,limit:limit}; }
function markNotification_(d) { const u=roleUser_(String(d.actorID||''),['USER','ADMIN','DEVELOPER']); const n=by_('Notifications','notificationID',String(d.notificationID||'')); if(!n||String(n.userID)!==String(u.userID)) fail_('NOT_FOUND','Notification was not found.'); if(n.readAt) return {updated:true}; return withLock_(function(){updateRow_('Notifications',n._row,{readAt:nowIso_()});return {updated:true};}); }

function planDetails_(plan) { const s=settingMap_(); if(plan==='MONTHLY') return {plan:'MONTHLY',amount:Number(s['payment.monthlyPrice']||199),days:Number(s['payment.monthlyDurationDays']||30)}; if(plan==='YEARLY') return {plan:'YEARLY',amount:Number(s['payment.yearlyPrice']||1999),days:Number(s['payment.yearlyDurationDays']||365)}; fail_('INVALID_INPUT','Select a valid membership plan.'); }
function publicPaymentRequest_(r) { return {requestID:String(r.requestID),userID:String(r.userID),fullName:String(r.fullName||''),mobile:String(r.mobile||''),email:String(r.email||''),agencyName:String(r.agencyName||''),subscriptionPlan:String(r.subscriptionPlan||''),amount:Number(r.amount||0),upiTransactionID:String(r.upiTransactionID||''),paymentDate:String(r.paymentDate||''),requestDate:String(r.requestDate||''),status:String(r.status||''),adminNotes:String(r.adminNotes||''),approvedBy:String(r.approvedBy||''),approvalDate:String(r.approvalDate||''),reviewedBy:String(r.reviewedBy||''),reviewedAt:String(r.reviewedAt||''),screenshotFileID:String(r.screenshotFileID||''),durationDays:Number(r.durationDays||0),whatsappNumber:String(r.whatsappNumber||'')}; }
function createPaymentRequest_(d) {
  const user=roleUser_(String(d.actorID||''),['USER','ADMIN','DEVELOPER']); const selectedPlan=String(d.plan||'');
  const settings=publicSettings_().settings;
  if(!settings.upiId||!settings.payeeName) fail_('PAYMENT_NOT_CONFIGURED','The administrator has not configured UPI payment details yet.');
  if(!settings.whatsappNumber) fail_('PAYMENT_NOT_CONFIGURED','The administrator has not configured WhatsApp support yet.');
  const utr=String(d.utr||'').trim().replace(/\s+/g,'').toUpperCase(); if(utr.length<6||utr.length>80||!/^[A-Z0-9\-/.]+$/.test(utr)) fail_('INVALID_INPUT','Enter a valid UPI transaction reference.');
  const payDate=String(d.paymentDate||''); const time=Date.parse(payDate+'T12:00:00Z'); if(!isFinite(time)||time>Date.now()+86400000||time<Date.now()-180*86400000) fail_('INVALID_INPUT','Payment date must be within the last 180 days and not in the future.');
  return withLock_(function(){
    const plan=planDetails_(selectedPlan); if(Number(d.expectedAmount)!==plan.amount) fail_('CONFLICT','The membership price changed. Refresh the payment page and verify the new amount before submitting.');
    const requests=records_('PaymentRequests');
    if(requests.some(function(r){return String(r.upiTransactionID||'').replace(/\s+/g,'').toUpperCase()===utr;})) fail_('CONFLICT','This UPI transaction reference has already been submitted. Contact support if you believe this is an error.');
    if(requests.some(function(r){return String(r.userID)===String(user.userID)&&(r.status==='PENDING VERIFICATION'||r.status==='MORE INFO REQUIRED');})) fail_('CONFLICT','You already have a payment request awaiting review. Wait for an admin response before submitting another.');
    let screenshot=''; if(d.screenshotFileID) { const f=by_('FileAssets','fileID',String(d.screenshotFileID)); if(!f||String(f.ownerID)!==String(user.userID)||f.purpose!=='PAYMENT_PROOF'||String(f.active)!=='TRUE') fail_('INVALID_INPUT','Payment screenshot reference is invalid.'); screenshot=String(f.fileID); }
    const id=newId_('PAY'); const now=nowIso_(); const req={requestID:id,userID:String(user.userID),fullName:String(user.fullName),mobile:String(user.mobile),email:String(user.email),agencyName:String(user.agencyName),subscriptionPlan:plan.plan,amount:plan.amount,upiTransactionID:utr,paymentDate:payDate,requestDate:now,status:'PENDING VERIFICATION',adminNotes:'',approvedBy:'',approvalDate:'',reviewedBy:'',reviewedAt:'',screenshotFileID:screenshot,durationDays:plan.days,whatsappNumber:String(user.whatsappNumber||''),createdAt:now,updatedAt:now};
    append_('PaymentRequests',req); if(screenshot){const f=by_('FileAssets','fileID',screenshot);updateRow_('FileAssets',f._row,{relatedID:id});}
    audit_(user.userID,'PAYMENT_REQUEST_CREATED','PAYMENT_REQUEST',id,{plan:plan.plan,amount:plan.amount}); notify_(user.userID,'PAYMENT_PENDING','Payment request submitted','Your '+plan.plan.toLowerCase()+' membership request is pending manual verification.',id); return publicPaymentRequest_(req);
  });
}
function myPaymentRequests_(d) { const u=roleUser_(String(d.actorID||''),['USER','ADMIN','DEVELOPER']); return rowsBy_('PaymentRequests','userID',String(u.userID)).sort(function(a,b){return String(b.requestDate).localeCompare(String(a.requestDate));}).map(publicPaymentRequest_); }
function adminPaymentRequests_(d) { requireAdmin_(String(d.actorID||'')); const status=String(d.status||''); const page=Math.max(1,Number(d.page)||1),limit=Math.min(100,Math.max(1,Number(d.limit)||30)); let rows=records_('PaymentRequests'); if(status) rows=rows.filter(function(r){return r.status===status;}); rows.sort(function(a,b){return String(b.requestDate).localeCompare(String(a.requestDate));}); return {items:rows.slice((page-1)*limit,page*limit).map(publicPaymentRequest_),total:rows.length,page:page,limit:limit}; }
function paymentDecision_(d) {
  const actor=requireAdmin_(String(d.actorID||'')); const id=String(d.requestID||''); const action=String(d.action||''); const notes=String(d.adminNotes||'').trim(); if(['APPROVE','REJECT','REQUEST_INFO'].indexOf(action)<0) fail_('INVALID_INPUT','Choose a valid review action.'); if(action!=='APPROVE'&&!notes) fail_('INVALID_INPUT','Add a reason or information request note.');
  return withLock_(function(){
    const req=by_('PaymentRequests','requestID',id); if(!req) fail_('NOT_FOUND','Payment request was not found.'); if(String(req.userID)===String(actor.userID)) fail_('FORBIDDEN','You cannot review your own payment request.');
    if(req.status!=='PENDING VERIFICATION'&&req.status!=='MORE INFO REQUIRED') fail_('CONFLICT','This payment request has already been reviewed.');
    if(action==='APPROVE'&&d.actualCreditVerified!==true) fail_('FORBIDDEN','Confirm that actual UPI credit was independently verified before approval.');
    const now=nowIso_(); const updated={adminNotes:notes,reviewedBy:String(actor.userID),reviewedAt:now,updatedAt:now};
    if(action==='REQUEST_INFO') { updated.status='MORE INFO REQUIRED'; updateRow_('PaymentRequests',req._row,updated); notify_(req.userID,'PAYMENT_INFO_REQUIRED','More information requested',notes,id); audit_(actor.userID,'PAYMENT_INFO_REQUESTED','PAYMENT_REQUEST',id,{notes:notes}); return publicPaymentRequest_(by_('PaymentRequests','requestID',id)); }
    if(action==='REJECT') { updated.status='REJECTED'; updateRow_('PaymentRequests',req._row,updated); notify_(req.userID,'PAYMENT_REJECTED','Payment request not approved',notes,id); audit_(actor.userID,'PAYMENT_REJECTED','PAYMENT_REQUEST',id,{reason:notes}); return publicPaymentRequest_(by_('PaymentRequests','requestID',id)); }
    if(records_('Payments').some(function(p){return String(p.requestID)===id||String(p.upiTransactionID||'').toUpperCase()===String(req.upiTransactionID||'').toUpperCase();})) fail_('CONFLICT','A payment record already exists for this request or UTR.');
    const user=currentUser_(String(req.userID)); if(String(user.accountStatus)!=='ACTIVE') fail_('FORBIDDEN','This member account is not active.');
    const currentExpiry=Date.parse(String(user.membershipExpiresAt||'')); const renewal=membershipStatus_(user)==='ACTIVE'&&currentExpiry>Date.now(); const startsMs=renewal?currentExpiry:Date.now(); const startsAt=new Date(startsMs).toISOString(); const expiresAt=isoPlusDays_(startsAt,Number(req.durationDays));
    const paymentID=newId_('PMT'); const subID=newId_('SUB');
    const existingSubs=rowsBy_('Subscriptions','userID',String(user.userID)); existingSubs.forEach(function(s){if(s.status==='ACTIVE'&&Date.parse(String(s.expiresAt||''))>Date.now()) updateRow_('Subscriptions',s._row,{status:'RENEWED'});});
    append_('Payments',{paymentID:paymentID,requestID:id,userID:req.userID,plan:req.subscriptionPlan,amount:Number(req.amount),upiTransactionID:req.upiTransactionID,paymentDate:req.paymentDate,status:'APPROVED',verifiedBy:String(actor.userID),verifiedAt:now,createdAt:now});
    append_('Subscriptions',{subscriptionID:subID,userID:req.userID,paymentRequestID:id,paymentID:paymentID,plan:req.subscriptionPlan,amount:Number(req.amount),durationDays:Number(req.durationDays),status:'ACTIVE',startsAt:startsAt,expiresAt:expiresAt,approvedBy:String(actor.userID),renewalType:renewal?'RENEWAL':'NEW',createdAt:now});
    updated.status='APPROVED'; updated.approvedBy=String(actor.userID); updated.approvalDate=now; updateRow_('PaymentRequests',req._row,updated); updateRow_('Users',user._row,{membershipStatus:'ACTIVE',currentPlan:req.subscriptionPlan,membershipStartAt:startsAt,membershipExpiresAt:expiresAt,updatedAt:now});
    notify_(req.userID,'MEMBERSHIP_ACTIVATED','Membership activated','Your '+String(req.subscriptionPlan).toLowerCase()+' membership is active until '+expiresAt.slice(0,10)+'.',id); audit_(actor.userID,'PAYMENT_APPROVED','PAYMENT_REQUEST',id,{paymentID:paymentID,subscriptionID:subID,startsAt:startsAt,expiresAt:expiresAt,amount:Number(req.amount),actualCreditVerified:d.actualCreditVerified===true});
    return {request:publicPaymentRequest_(by_('PaymentRequests','requestID',id)),paymentID:paymentID,subscriptionID:subID,startsAt:startsAt,expiresAt:expiresAt};
  });
}

function listingPublic_(r) {
  return {listingID:String(r.listingID),ownerID:String(r.ownerID),title:String(r.title||''),transactionType:String(r.transactionType||''),propertyType:String(r.propertyType||''),bhk:String(r.bhk||''),city:String(r.city||''),locality:String(r.locality||''),landmark:String(r.landmark||''),carpetArea:String(r.carpetArea||''),builtUpArea:String(r.builtUpArea||''),furnishing:String(r.furnishing||'NOT_SPECIFIED'),floor:String(r.floor||''),amenities:parseJson_(r.amenitiesJson,[]),price:Number(r.price||0),rent:Number(r.rent||0),deposit:Number(r.deposit||0),availability:String(r.availability||''),tenantPreference:String(r.tenantPreference||''),contactNumbers:parseJson_(r.contactNumbersJson,[]),description:String(r.description||''),originalText:String(r.originalText||''),images:parseJson_(r.imagesJson,[]),status:String(r.status||'DRAFT'),availabilityConfirmedAt:String(r.availabilityConfirmedAt||''),reconfirmDueAt:String(r.reconfirmDueAt||''),createdAt:String(r.createdAt||''),updatedAt:String(r.updatedAt||''),broker:brokerSummary_(String(r.ownerID))};
}
function listingData_(d) {
  const text=function(key,max,required){const value=String(d[key]||'').trim();if(required&&value.length<2)fail_('INVALID_INPUT',key+' is required.');if(value.length>max)fail_('INVALID_INPUT',key+' is too long.');return value;};
  const txn=String(d.transactionType||'');const transactions=['RENT','SALE','RESALE','HEAVY_DEPOSIT','LEASE','COMMERCIAL_RENT','COMMERCIAL_SALE'];if(transactions.indexOf(txn)<0)fail_('INVALID_INPUT','Invalid transaction type.');
  const furnishing=String(d.furnishing||'NOT_SPECIFIED');if(['FURNISHED','SEMI_FURNISHED','UNFURNISHED','NOT_SPECIFIED'].indexOf(furnishing)<0)fail_('INVALID_INPUT','Invalid furnishing value.');
  const num=function(key){const raw=String(d[key]||'').replace(/[₹,\s]/g,'');if(!raw)return 0;const n=Number(raw);if(!isFinite(n)||n<0||n>1000000000000)fail_('INVALID_INPUT','Invalid numeric value for '+key+'.');return Math.round(n);};
  const list=function(key,maxItems,maxLength){const arr=Array.isArray(d[key])?d[key]:[];if(arr.length>maxItems)fail_('INVALID_INPUT',key+' has too many values.');return arr.map(function(v){const s=String(v||'').trim();if(s.length>maxLength)fail_('INVALID_INPUT',key+' contains a value that is too long.');return s;}).filter(Boolean);};
  const amenities=list('amenities',30,60);const contacts=list('contactNumbers',10,24);contacts.forEach(function(v){if(!/^\+?[0-9][0-9\s().-]{7,19}$/.test(v))fail_('INVALID_INPUT','Invalid contact number.');});
  const images=list('images',10,120);
  return {title:text('title',140,true),transactionType:txn,propertyType:text('propertyType',80,true),bhk:text('bhk',20,false),city:text('city',80,true),locality:text('locality',100,true),landmark:text('landmark',120,false),carpetArea:text('carpetArea',40,false),builtUpArea:text('builtUpArea',40,false),furnishing:furnishing,floor:text('floor',40,false),amenitiesJson:JSON.stringify(amenities),price:num('price'),rent:num('rent'),deposit:num('deposit'),availability:text('availability',80,false),tenantPreference:text('tenantPreference',100,false),contactNumbersJson:JSON.stringify(contacts),description:text('description',3000,false),originalText:text('originalText',12000,false),imagesJson:JSON.stringify(images)};
}
function brokerSummary_(userID) { const u=by_('Users','userID',userID); const p=by_('BrokerProfiles','userID',userID); return u?{userID:String(u.userID),fullName:String(u.fullName||''),agencyName:String(u.agencyName||''),city:String(u.city||''),isVerified:p?String(p.isVerified)==='TRUE':false,bio:p?String(p.bio||''):''}:null; }
function createListing_(d) {
  const u=requireMember_(String(d.actorID||'')); const payload=d.listing||{}; const now=nowIso_();
  const data=listingData_(payload); data.status='DRAFT'; const id=newId_('LST');
  return withLock_(function(){ append_('Listings',{listingID:id,ownerID:String(u.userID),...data,availabilityConfirmedAt:'',reconfirmDueAt:'',createdAt:now,updatedAt:now}); audit_(u.userID,'LISTING_CREATED','LISTING',id,{status:'DRAFT'}); return listingPublic_(by_('Listings','listingID',id)); });
}
function duplicateCandidates_(candidate,excludeID) {
  const norm=function(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');};
  return records_('Listings').filter(function(r){
    if(String(r.listingID)===String(excludeID)||r.status==='DELETED'||r.status==='SOLD'||r.status==='RENTED'||r.status==='UNAVAILABLE') return false;
    const same=norm(r.city)===norm(candidate.city)&&norm(r.locality)===norm(candidate.locality)&&norm(r.propertyType)===norm(candidate.propertyType)&&norm(r.transactionType)===norm(candidate.transactionType)&&norm(r.bhk)===norm(candidate.bhk);
    if(!same) return false;
    const a=Number(r.price||r.rent||0), b=Number(candidate.price||candidate.rent||0); return !a||!b||Math.abs(a-b)/Math.max(a,b)<=0.1;
  }).slice(0,5).map(function(r){return {listingID:r.listingID,title:r.title,city:r.city,locality:r.locality,status:r.status};});
}
function mergeListing_(r,patch) {
  const current=listingPublic_(r); const merged={...current,...patch};
  return listingData_(merged);
}
function updateListing_(d) {
  const actor=roleUser_(String(d.actorID||''),['USER','ADMIN','DEVELOPER']); const id=String(d.listingID||''); const patch=d.patch||{}; const isAdmin=actor.role==='ADMIN'||actor.role==='DEVELOPER';
  if(patch.status==='ACTIVE'&&!isAdmin) requireMember_(String(actor.userID));
  return withLock_(function(){
    const r=by_('Listings','listingID',id); if(!r||r.status==='DELETED') fail_('NOT_FOUND','Listing was not found.');
    if(String(r.ownerID)!==String(actor.userID)&&!isAdmin) fail_('FORBIDDEN','You can only edit your own listing.');
    if(!isAdmin&&r.status==='UNDER_REVIEW'&&patch.status==='ACTIVE') fail_('FORBIDDEN','Use the explicit availability reconfirmation action to restore a listing under review.');
    const askedStatus=String(patch.status||r.status); if(!isAdmin&&patch.status&&['DRAFT','ACTIVE','SOLD','RENTED','UNAVAILABLE'].indexOf(askedStatus)<0) fail_('FORBIDDEN','That listing status cannot be set by a member.');
    const merged=mergeListing_(r,patch); const normalized=listingData_(merged); const images=parseJson_(normalized.imagesJson,[]);
    images.forEach(function(fileID){const f=by_('FileAssets','fileID',fileID);if(!f||f.purpose!=='LISTING_IMAGE'||String(f.active)!=='TRUE'||String(f.ownerID)!==String(r.ownerID)||String(f.relatedID)!==id)fail_('INVALID_INPUT','A listing photo reference is invalid.');});
    const duplicates=patch.status==='ACTIVE'?duplicateCandidates_(Object.assign({},normalized,{images:images}),id):[]; if(duplicates.length&&!d.confirmDuplicates) return {requiresConfirmation:true,duplicates:duplicates};
    const now=nowIso_(); const rowPatch=Object.assign({},normalized,{status:askedStatus,updatedAt:now});
    if(askedStatus==='ACTIVE'&&String(r.status)!=='ACTIVE'){rowPatch.availabilityConfirmedAt=now;rowPatch.reconfirmDueAt=isoPlusDays_(now,15);}
    updateRow_('Listings',r._row,rowPatch); audit_(actor.userID,'LISTING_UPDATED','LISTING',id,{status:askedStatus}); return {listing:listingPublic_(by_('Listings','listingID',id)),duplicates:duplicates};
  });
}
function deleteListing_(d) { const actor=roleUser_(String(d.actorID||''),['USER','ADMIN','DEVELOPER']); const r=by_('Listings','listingID',String(d.listingID||'')); if(!r||r.status==='DELETED') fail_('NOT_FOUND','Listing was not found.'); if(String(r.ownerID)!==String(actor.userID)&&actor.role!=='ADMIN'&&actor.role!=='DEVELOPER') fail_('FORBIDDEN','You can only delete your own listing.'); return withLock_(function(){updateRow_('Listings',r._row,{status:'DELETED',updatedAt:nowIso_()});audit_(actor.userID,'LISTING_DELETED','LISTING',r.listingID,{});return {deleted:true};}); }
function myListings_(d) { const actor=roleUser_(String(d.actorID||''),['USER','ADMIN','DEVELOPER']); const rows=rowsBy_('Listings','ownerID',String(actor.userID)).filter(function(r){return r.status!=='DELETED';}).sort(function(a,b){return String(b.updatedAt).localeCompare(String(a.updatedAt));}); return rows.map(function(r){const out=listingPublic_(r);out.needsReconfirmation=r.status==='ACTIVE'&&Date.parse(String(r.reconfirmDueAt||''))<=Date.now();return out;}); }
function getListing_(d) { const actor=roleUser_(String(d.actorID||''),['USER','ADMIN','DEVELOPER']); const r=by_('Listings','listingID',String(d.listingID||'')); if(!r||r.status==='DELETED') fail_('NOT_FOUND','Listing was not found.'); const own=String(r.ownerID)===String(actor.userID); const privileged=actor.role==='ADMIN'||actor.role==='DEVELOPER'; if(!own&&!privileged) requireMember_(String(actor.userID)); if(r.status!=='ACTIVE'&&!own&&!privileged) fail_('NOT_FOUND','This listing is not currently available.'); const out=listingPublic_(r); out.needsReconfirmation=r.status==='ACTIVE'&&Date.parse(String(r.reconfirmDueAt||''))<=Date.now(); return out; }
function searchListings_(d) {
  const actor=roleUser_(String(d.actorID||''),['USER','ADMIN','DEVELOPER']); const privileged=actor.role==='ADMIN'||actor.role==='DEVELOPER'; if(!privileged) requireMember_(String(actor.userID));
  const f=d.filters||{}; const page=Math.max(1,Number(d.page)||1),limit=Math.min(50,Math.max(1,Number(d.limit)||20)); const text=String(f.q||'').toLowerCase(); let rows=records_('Listings').filter(function(r){
    if(r.status==='DELETED') return false; if(!privileged&&(r.status!=='ACTIVE'||Date.parse(String(r.reconfirmDueAt||''))<=Date.now())) return false;
    const match=function(key,value){return !value||String(r[key]||'').toLowerCase()===String(value).toLowerCase();};
    if(!match('city',f.city)||!match('locality',f.locality)||!match('transactionType',f.transactionType)||!match('propertyType',f.propertyType)||!match('bhk',f.bhk)||!match('furnishing',f.furnishing)) return false;
    if(f.availability&&String(r.availability||'').toLowerCase().indexOf(String(f.availability).toLowerCase())<0)return false;
    const price=Number(r.price||0),rent=Number(r.rent||0),deposit=Number(r.deposit||0); if(f.minPrice&&price<Number(f.minPrice))return false;if(f.maxPrice&&price>Number(f.maxPrice))return false;if(f.minRent&&rent<Number(f.minRent))return false;if(f.maxRent&&rent>Number(f.maxRent))return false;if(f.minDeposit&&deposit<Number(f.minDeposit))return false;if(f.maxDeposit&&deposit>Number(f.maxDeposit))return false;
    const areaText=String(r.carpetArea||r.builtUpArea||'').replace(/[^0-9.]/g,'');const area=Number(areaText||0);if(f.minArea&&area<Number(f.minArea))return false;if(f.maxArea&&area>Number(f.maxArea))return false;
    if(text&&[r.title,r.city,r.locality,r.landmark,r.propertyType,r.description].join(' ').toLowerCase().indexOf(text)<0)return false; return true;
  });
  rows.sort(function(a,b){return String(b.updatedAt).localeCompare(String(a.updatedAt));}); return {items:rows.slice((page-1)*limit,page*limit).map(function(r){const o=listingPublic_(r);o.needsReconfirmation=r.status==='ACTIVE'&&Date.parse(String(r.reconfirmDueAt||''))<=Date.now();return o;}),total:rows.length,page:page,limit:limit};
}
function reconfirmListing_(d) { const actor=roleUser_(String(d.actorID||''),['USER','ADMIN','DEVELOPER']); const r=by_('Listings','listingID',String(d.listingID||'')); if(!r||String(r.ownerID)!==String(actor.userID)&&actor.role!=='ADMIN'&&actor.role!=='DEVELOPER') fail_('NOT_FOUND','Listing was not found.'); if(r.status!=='UNDER_REVIEW'&&!(r.status==='ACTIVE'&&Date.parse(String(r.reconfirmDueAt||''))<=Date.now())) fail_('CONFLICT','This listing is not due for reconfirmation.'); if(actor.role==='USER') requireMember_(String(actor.userID)); return withLock_(function(){const now=nowIso_();updateRow_('Listings',r._row,{status:'ACTIVE',availabilityConfirmedAt:now,reconfirmDueAt:isoPlusDays_(now,15),updatedAt:now});audit_(actor.userID,'LISTING_RECONFIRMED','LISTING',r.listingID,{});return listingPublic_(by_('Listings','listingID',r.listingID));}); }
function runAvailabilityReconfirmation_() { withLock_(function(){const now=Date.now();records_('Listings').forEach(function(r){if(r.status==='ACTIVE'&&Date.parse(String(r.reconfirmDueAt||''))>0&&Date.parse(String(r.reconfirmDueAt))<=now){updateRow_('Listings',r._row,{status:'UNDER_REVIEW',updatedAt:nowIso_()});notify_(r.ownerID,'LISTING_RECONFIRMATION','Confirm listing availability','Your listing '+r.title+' needs availability reconfirmation before it appears in search.',r.listingID);audit_('SYSTEM','LISTING_REQUIRES_RECONFIRMATION','LISTING',r.listingID,{});}});}); }
function adminListings_(d) { requireAdmin_(String(d.actorID||'')); const status=String(d.status||''); const page=Math.max(1,Number(d.page)||1),limit=Math.min(100,Math.max(1,Number(d.limit)||30)); let rows=records_('Listings').filter(function(r){return r.status!=='DELETED';}); if(status) rows=rows.filter(function(r){return r.status===status;}); rows.sort(function(a,b){return String(b.updatedAt).localeCompare(String(a.updatedAt));}); return {items:rows.slice((page-1)*limit,page*limit).map(listingPublic_),total:rows.length,page:page,limit:limit}; }
function adminListingDecision_(d) { const actor=requireAdmin_(String(d.actorID||'')); const r=by_('Listings','listingID',String(d.listingID||'')); if(!r) fail_('NOT_FOUND','Listing was not found.'); const status=String(d.status||''); if(['ACTIVE','DRAFT','SOLD','RENTED','UNAVAILABLE','UNDER_REVIEW','DELETED'].indexOf(status)<0) fail_('INVALID_INPUT','Invalid listing status.'); return withLock_(function(){const now=nowIso_(); const p={status:status,updatedAt:now}; if(status==='ACTIVE'){p.availabilityConfirmedAt=now;p.reconfirmDueAt=isoPlusDays_(now,15);} updateRow_('Listings',r._row,p); audit_(actor.userID,'ADMIN_LISTING_STATUS','LISTING',r.listingID,{status:status}); notify_(r.ownerID,'LISTING_REVIEW','Listing reviewed','An administrator updated the status of your listing '+r.title+'.',r.listingID); return listingPublic_(by_('Listings','listingID',r.listingID));}); }
function scheduledAvailabilityReview() { runAvailabilityReconfirmation_(); }

function listCategories_() { const cache=CacheService.getScriptCache(); const hit=cache.get('categories-v1'); if(hit) return JSON.parse(hit); const rows=records_('Categories').filter(function(r){return String(r.active)==='TRUE';}).sort(function(a,b){return Number(a.sortOrder)-Number(b.sortOrder);}).map(function(r){return {categoryID:r.categoryID,name:r.name,parentID:r.parentID,kind:r.kind,sortOrder:Number(r.sortOrder)};}); cache.put('categories-v1',JSON.stringify(rows),600); return rows; }
function saveCategory_(d) { const actor=requireAdmin_(String(d.actorID||'')); const id=String(d.categoryID||newId_('CAT')); const now=nowIso_(); return withLock_(function(){const old=by_('Categories','categoryID',id); if(old) updateRow_('Categories',old._row,{name:String(d.name).trim(),parentID:String(d.parentID||''),kind:String(d.kind),active:d.active?'TRUE':'FALSE',sortOrder:Number(d.sortOrder||100),updatedAt:now}); else append_('Categories',{categoryID:id,name:String(d.name).trim(),parentID:String(d.parentID||''),kind:String(d.kind),active:d.active?'TRUE':'FALSE',sortOrder:Number(d.sortOrder||100),createdAt:now,updatedAt:now}); CacheService.getScriptCache().remove('categories-v1'); audit_(actor.userID,'CATEGORY_SAVED','CATEGORY',id,{}); return listCategories_();}); }
function deleteCategory_(d) { const actor=requireAdmin_(String(d.actorID||'')); const c=by_('Categories','categoryID',String(d.categoryID||'')); if(!c) fail_('NOT_FOUND','Category was not found.'); return withLock_(function(){updateRow_('Categories',c._row,{active:'FALSE',updatedAt:nowIso_()});CacheService.getScriptCache().remove('categories-v1');audit_(actor.userID,'CATEGORY_ARCHIVED','CATEGORY',c.categoryID,{});return {deleted:true};}); }
function listLocalities_(d) { const q=String(d.q||'').toLowerCase(); const cache=CacheService.getScriptCache(); const hit=cache.get('localities-v1'); let rows=hit?JSON.parse(hit):records_('Localities').filter(function(r){return String(r.active)==='TRUE';}).sort(function(a,b){return String(a.city).localeCompare(String(b.city))||String(a.name).localeCompare(String(b.name));}).map(function(r){return {localityID:r.localityID,city:r.city,name:r.name,state:r.state};}); if(!hit) cache.put('localities-v1',JSON.stringify(rows),600); if(q) rows=rows.filter(function(r){return (r.name+' '+r.city+' '+r.state).toLowerCase().indexOf(q)>=0;}); return rows.slice(0,200); }
function saveLocality_(d) { const actor=requireAdmin_(String(d.actorID||'')); const id=String(d.localityID||newId_('LOC')); const now=nowIso_(); return withLock_(function(){const old=by_('Localities','localityID',id);if(old) updateRow_('Localities',old._row,{city:String(d.city).trim(),name:String(d.name).trim(),state:String(d.state||'Maharashtra').trim(),active:d.active?'TRUE':'FALSE',updatedAt:now});else append_('Localities',{localityID:id,city:String(d.city).trim(),name:String(d.name).trim(),state:String(d.state||'Maharashtra').trim(),active:d.active?'TRUE':'FALSE',createdAt:now,updatedAt:now});CacheService.getScriptCache().remove('localities-v1');audit_(actor.userID,'LOCALITY_SAVED','LOCALITY',id,{});return listLocalities_({});}); }
function deleteLocality_(d) { const actor=requireAdmin_(String(d.actorID||'')); const old=by_('Localities','localityID',String(d.localityID||''));if(!old)fail_('NOT_FOUND','Locality was not found.');return withLock_(function(){updateRow_('Localities',old._row,{active:'FALSE',updatedAt:nowIso_()});CacheService.getScriptCache().remove('localities-v1');audit_(actor.userID,'LOCALITY_ARCHIVED','LOCALITY',old.localityID,{});return {deleted:true};}); }

function listFavourites_(d) { const u=requireMember_(String(d.actorID||'')); const ids=rowsBy_('Favourites','userID',String(u.userID)).map(function(f){return f.listingID;}); return ids.map(function(id){const r=by_('Listings','listingID',id);return r&&r.status==='ACTIVE'&&Date.parse(String(r.reconfirmDueAt||''))>Date.now()?listingPublic_(r):null;}).filter(Boolean); }
function addFavourite_(d) { const u=requireMember_(String(d.actorID||'')); const l=by_('Listings','listingID',String(d.listingID||'')); if(!l||l.status!=='ACTIVE'||Date.parse(String(l.reconfirmDueAt||''))<=Date.now()) fail_('NOT_FOUND','This listing is not currently available.'); return withLock_(function(){const already=records_('Favourites').some(function(f){return String(f.userID)===String(u.userID)&&String(f.listingID)===String(l.listingID);});if(!already)append_('Favourites',{favouriteID:newId_('FAV'),userID:u.userID,listingID:l.listingID,createdAt:nowIso_()});return {saved:true};}); }
function removeFavourite_(d) { const u=roleUser_(String(d.actorID||''),['USER','ADMIN','DEVELOPER']); const f=records_('Favourites').find(function(r){return String(r.userID)===String(u.userID)&&String(r.listingID)===String(d.listingID||'');}); if(!f) return {removed:true}; return withLock_(function(){getSheet_('Favourites').deleteRow(f._row);return {removed:true};}); }
function createReport_(d) { const u=requireMember_(String(d.actorID||'')); const l=by_('Listings','listingID',String(d.listingID||'')); if(!l||l.status==='DELETED') fail_('NOT_FOUND','Listing was not found.'); return withLock_(function(){const dup=records_('Reports').some(function(r){return String(r.reporterID)===String(u.userID)&&String(r.listingID)===String(l.listingID)&&['OPEN','UNDER_REVIEW'].indexOf(String(r.status))>=0;}); if(dup) fail_('CONFLICT','You have already reported this listing.');const id=newId_('RPT');append_('Reports',{reportID:id,listingID:l.listingID,reporterID:u.userID,reason:String(d.reason||'OTHER'),details:String(d.details||''),status:'OPEN',adminNotes:'',reviewedBy:'',reviewedAt:'',createdAt:nowIso_()});audit_(u.userID,'LISTING_REPORTED','REPORT',id,{listingID:l.listingID,reason:d.reason});return {reportID:id,status:'OPEN'};}); }
function adminReports_(d) { requireAdmin_(String(d.actorID||'')); const status=String(d.status||''); const rows=records_('Reports').filter(function(r){return !status||r.status===status;}).sort(function(a,b){return String(b.createdAt).localeCompare(String(a.createdAt));}); return rows.slice(0,200).map(function(r){return {reportID:r.reportID,listingID:r.listingID,reporterID:r.reporterID,reason:r.reason,details:r.details,status:r.status,adminNotes:r.adminNotes,reviewedBy:r.reviewedBy,reviewedAt:r.reviewedAt,createdAt:r.createdAt,listing:(function(){const l=by_('Listings','listingID',r.listingID);return l?{listingID:l.listingID,title:l.title,status:l.status,city:l.city,locality:l.locality}:null;})()};}); }
function reportDecision_(d) { const actor=requireAdmin_(String(d.actorID||'')); const r=by_('Reports','reportID',String(d.reportID||'')); if(!r) fail_('NOT_FOUND','Report was not found.'); const status=String(d.status||''); if(['UNDER_REVIEW','RESOLVED','DISMISSED'].indexOf(status)<0) fail_('INVALID_INPUT','Invalid report status.'); return withLock_(function(){updateRow_('Reports',r._row,{status:status,adminNotes:String(d.adminNotes||''),reviewedBy:actor.userID,reviewedAt:nowIso_()});audit_(actor.userID,'REPORT_REVIEWED','REPORT',r.reportID,{status:status});return {updated:true};}); }
function adminUsers_(d) { requireAdmin_(String(d.actorID||'')); const page=Math.max(1,Number(d.page)||1),limit=Math.min(100,Math.max(1,Number(d.limit)||30)); const q=String(d.q||'').toLowerCase(); const all=records_('Users').filter(function(u){return !q||[u.fullName,u.email,u.mobile,u.agencyName,u.city].join(' ').toLowerCase().indexOf(q)>=0;}).sort(function(a,b){return String(b.createdAt).localeCompare(String(a.createdAt));}); const items=all.slice((page-1)*limit,page*limit).map(function(u){const pub=publicUser_(u);return Object.assign(pub,{accountStatus:String(u.accountStatus),membershipStatus:membershipStatus_(u),listingCount:rowsBy_('Listings','ownerID',u.userID).filter(function(l){return l.status!=='DELETED';}).length});}); return {items:items,total:all.length,page:page,limit:limit}; }
function adminUserAction_(d) { const actor=requireAdmin_(String(d.actorID||'')); const id=String(d.userID||''); const target=currentUser_(id); const action=String(d.action||''); if(String(target.role)==='DEVELOPER') fail_('FORBIDDEN','The developer account cannot be changed by an administrator.'); if(['SUSPEND','REACTIVATE','VERIFY_BROKER','UNVERIFY_BROKER'].indexOf(action)<0) fail_('FORBIDDEN','Admin role changes are reserved for the developer.'); return withLock_(function(){const now=nowIso_(); if(action==='SUSPEND'||action==='REACTIVATE'){updateRow_('Users',target._row,{accountStatus:action==='SUSPEND'?'SUSPENDED':'ACTIVE',updatedAt:now});notify_(id,'ACCOUNT_STATUS','Account status updated',action==='SUSPEND'?'Your account has been suspended. Contact support for details.':'Your account has been reactivated.','');}else{const p=by_('BrokerProfiles','userID',id);if(p)updateRow_('BrokerProfiles',p._row,{isVerified:action==='VERIFY_BROKER'?'TRUE':'FALSE',verifiedBy:actor.userID,verifiedAt:action==='VERIFY_BROKER'?now:'',updatedAt:now});notify_(id,'BROKER_PROFILE','Broker profile reviewed',action==='VERIFY_BROKER'?'Your broker profile has been verified.':'Your broker verification was changed.','');}audit_(actor.userID,'ADMIN_USER_ACTION','USER',id,{action:action,reason:String(d.reason||'')});return publicUser_(by_('Users','userID',id));}); }
function createAnnouncement_(d) { const actor=requireAdmin_(String(d.actorID||'')); const title=String(d.title||'').trim(),body=String(d.body||'').trim(); const audience=String(d.audience||'ALL'); if(!title||!body) fail_('INVALID_INPUT','Announcement title and body are required.'); return withLock_(function(){const users=records_('Users').filter(function(u){return u.accountStatus==='ACTIVE'&&(audience!=='ACTIVE_MEMBERS'||membershipStatus_(u)==='ACTIVE');}); if(users.length>5000) fail_('RATE_LIMITED','Announcement audience exceeds the current batch limit.'); users.forEach(function(u){notify_(u.userID,'ANNOUNCEMENT',title,body,'');});audit_(actor.userID,'ANNOUNCEMENT_SENT','NOTIFICATION',title,{audience:audience,recipientCount:users.length});return {sent:true,recipientCount:users.length};}); }
function developerUserRole_(d) { const actor=requireDeveloper_(String(d.actorID||'')); const id=String(d.userID||''); const target=currentUser_(id); if(id===String(actor.userID)||String(target.role)==='DEVELOPER') fail_('FORBIDDEN','The original developer account is exclusive and cannot be changed.'); const action=String(d.action||''); if(['MAKE_ADMIN','REMOVE_ADMIN'].indexOf(action)<0) fail_('INVALID_INPUT','Invalid administrator action.'); return withLock_(function(){const now=nowIso_(); const role=action==='MAKE_ADMIN'?'ADMIN':'USER';updateRow_('Users',target._row,{role:role,updatedAt:now}); const admin=by_('Admins','userID',id); if(role==='ADMIN'){if(admin)updateRow_('Admins',admin._row,{status:'ACTIVE',updatedAt:now});else append_('Admins',{adminID:newId_('ADM'),userID:id,email:target.email,status:'ACTIVE',createdAt:now,updatedAt:now});}else if(admin)updateRow_('Admins',admin._row,{status:'REVOKED',updatedAt:now}); audit_(actor.userID,'DEVELOPER_ADMIN_ROLE_CHANGED','USER',id,{action:action,reason:String(d.reason||'')});notify_(id,'ADMIN_ROLE','Account role updated',role==='ADMIN'?'You have been granted administrator access.':'Your administrator access has been removed.','');return publicUser_(by_('Users','userID',id));}); }

function developerSecurityLogs_(d) {
  requireDeveloper_(String(d.actorID||''));
  const page=Math.max(1,Number(d.page)||1),limit=Math.min(100,Math.max(1,Number(d.limit)||30));
  const rows=records_('SecurityLogs').sort(function(a,b){return String(b.createdAt).localeCompare(String(a.createdAt));});
  return {items:rows.slice((page-1)*limit,page*limit).map(function(r){return {securityLogID:String(r.securityLogID||''),actorID:String(r.actorID||''),eventType:String(r.eventType||''),subject:String(r.subject||''),ipHash:String(r.ipHash||''),userAgent:String(r.userAgent||''),details:parseJson_(r.detailsJson,{}),createdAt:String(r.createdAt||'')};}),total:rows.length,page:page,limit:limit};
}
function developerAnalytics_(d) {
  requireDeveloper_(String(d.actorID||''));
  const payments=records_('Payments').filter(function(p){return p.status==='APPROVED';}); const reqs=records_('PaymentRequests'); const users=records_('Users'); const now=Date.now();
  const total=payments.reduce(function(s,p){return s+Number(p.amount||0);},0); const monthly=payments.filter(function(p){return p.plan==='MONTHLY';}).reduce(function(s,p){return s+Number(p.amount||0);},0); const yearly=payments.filter(function(p){return p.plan==='YEARLY';}).reduce(function(s,p){return s+Number(p.amount||0);},0);
  const active=users.filter(function(u){return membershipStatus_(u)==='ACTIVE';}).length; const expired=users.filter(function(u){return membershipStatus_(u)==='EXPIRED';}).length; const approvedReqs=reqs.filter(function(r){return r.status==='APPROVED';}); const renewalCount=records_('Subscriptions').filter(function(s){return s.renewalType==='RENEWAL';}).length;
  const months=[]; for(let i=11;i>=0;i--){const d=new Date();d.setDate(1);d.setHours(0,0,0,0);d.setMonth(d.getMonth()-i);const ym=d.toISOString().slice(0,7);const paymentsForMonth=payments.filter(function(p){return String(p.verifiedAt||'').slice(0,7)===ym;});months.push({month:ym,revenue:paymentsForMonth.reduce(function(s,p){return s+Number(p.amount||0);},0),payments:paymentsForMonth.length});}
  return {totalPaymentRequests:reqs.length,pendingVerification:reqs.filter(function(r){return r.status==='PENDING VERIFICATION'||r.status==='MORE INFO REQUIRED';}).length,approvedPayments:payments.length,rejectedPayments:reqs.filter(function(r){return r.status==='REJECTED';}).length,monthlyMembershipRevenue:monthly,yearlyMembershipRevenue:yearly,totalCollectedRevenue:total,activeSubscribers:active,expiredSubscribers:expired,subscriptionRenewals:renewalCount,renewalRate:approvedReqs.length?Math.round(renewalCount/approvedReqs.length*100):0,monthlyTrend:months};
}
function developerExportData_(d) { const actor=requireDeveloper_(String(d.actorID||'')); const a=developerAnalytics_({actorID:actor.userID}); const payments=records_('Payments').filter(function(p){return p.status==='APPROVED';}); const byPlan=['MONTHLY','YEARLY'].map(function(plan){const items=payments.filter(function(p){return p.plan===plan;});return {plan:plan,approvedPayments:items.length,revenue:items.reduce(function(s,p){return s+Number(p.amount||0);},0)};}); return {exportedAt:nowIso_(),summary:a,byPlan:byPlan,monthlyTrend:a.monthlyTrend}; }

function createDatabaseBackup_(actorID) {
  if(actorID!=='SYSTEM') requireDeveloper_(String(actorID)); const props=PropertiesService.getScriptProperties(); const folderId=props.getProperty('FOLDER_DATABASE_BACKUPS'); const spreadsheetId=props.getProperty('SPREADSHEET_ID'); if(!folderId||!spreadsheetId) fail_('BACKEND_NOT_CONFIGURED','Backup folder or spreadsheet is not configured.');
  const folder=DriveApp.getFolderById(folderId); const source=DriveApp.getFileById(spreadsheetId); const stamp=Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'Asia/Kolkata','yyyy-MM-dd HHmm'); const copy=source.makeCopy('Broker2Broker Database backup '+stamp,folder); audit_(actorID,'DATABASE_BACKUP_CREATED','DRIVE_FILE',copy.getId(),{name:copy.getName()}); return {created:true,fileName:copy.getName(),createdAt:nowIso_()};
}
function scheduledDatabaseBackup() { createDatabaseBackup_('SYSTEM'); }
function scheduledListingReconfirmation() { runAvailabilityReconfirmation_(); }
function systemHealth_() { const props=PropertiesService.getScriptProperties(); const missing=[]; Object.keys(SCHEMAS).forEach(function(n){if(!getSpreadsheet_().getSheetByName(n))missing.push(n);}); const triggers=ScriptApp.getProjectTriggers().map(function(t){return t.getHandlerFunction();}); return {service:B2B.NAME,version:B2B.VERSION,spreadsheetConfigured:!!props.getProperty('SPREADSHEET_ID'),driveConfigured:!!props.getProperty('DRIVE_ROOT_ID'),missingSheets:missing,backupScheduled:triggers.indexOf('scheduledDatabaseBackup')>=0,reconfirmationScheduled:triggers.indexOf('scheduledListingReconfirmation')>=0,developerBootstrapped:records_('Developer').some(function(d){return d.status==='ACTIVE';}),errors:missing.length?['Missing sheets: '+missing.join(', ')]:[]}; }

function uploadFile_(d) {
  const actor=roleUser_(String(d.actorID||''),['USER','ADMIN','DEVELOPER']); const purpose=String(d.purpose||''); const related=String(d.relatedID||'');
  if(purpose==='PAYMENT_PROOF'&&!['USER','ADMIN','DEVELOPER'].includes(actor.role)) fail_('FORBIDDEN','Not authorized.');
  if((purpose==='QR_CODE')&&actor.role!=='ADMIN'&&actor.role!=='DEVELOPER') fail_('FORBIDDEN','Only administrators can upload the payment QR image.');
  if(purpose==='LISTING_IMAGE'){requireMember_(actor.userID);const l=by_('Listings','listingID',related);if(!l||String(l.ownerID)!==String(actor.userID))fail_('FORBIDDEN','Listing image must belong to one of your listings.');}
  const mime=String(d.mimeType||''); if(['image/jpeg','image/png','image/webp'].indexOf(mime)<0) fail_('INVALID_INPUT','Upload a JPEG, PNG or WebP image.');
  const decoded=Utilities.base64Decode(String(d.base64||'')); if(decoded.length>2600000) fail_('INVALID_INPUT','Image size must be 2.5 MB or less.');
  const folderKey=purpose==='PAYMENT_PROOF'?'FOLDER_PAYMENT_SCREENSHOTS':purpose==='LISTING_IMAGE'?'FOLDER_LISTING_IMAGES':'FOLDER_PLATFORM_ASSETS'; const folderId=PropertiesService.getScriptProperties().getProperty(folderKey); if(!folderId) fail_('BACKEND_NOT_CONFIGURED','Drive storage folders are not configured.');
  const safeName=String(d.fileName||'image').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-140); const blob=Utilities.newBlob(decoded,mime,safeName); const folder=DriveApp.getFolderById(folderId); const driveFile=folder.createFile(blob); const id=newId_('FIL'); const now=nowIso_();
  append_('FileAssets',{fileID:id,ownerID:actor.userID,purpose:purpose,relatedID:related,driveFileID:driveFile.getId(),fileName:safeName,mimeType:mime,sizeBytes:decoded.length,active:'TRUE',createdAt:now}); audit_(actor.userID,'FILE_UPLOADED','FILE',id,{purpose:purpose,mimeType:mime,sizeBytes:decoded.length});
  if(purpose==='QR_CODE'){const s=by_('Settings','key','payment.upiQrFileId');if(s)updateRow_('Settings',s._row,{value:id,updatedBy:actor.userID,updatedAt:now});else append_('Settings',{settingID:newId_('SET'),key:'payment.upiQrFileId',value:id,valueType:'string',isPublic:'FALSE',updatedBy:actor.userID,updatedAt:now});}
  return {fileID:id,fileName:safeName,mimeType:mime,sizeBytes:decoded.length};
}
function getFile_(d) {
  const actor=roleUser_(String(d.actorID||''),['USER','ADMIN','DEVELOPER']); const f=by_('FileAssets','fileID',String(d.fileID||'')); if(!f||String(f.active)!=='TRUE') fail_('NOT_FOUND','File was not found.'); const admin=actor.role==='ADMIN'||actor.role==='DEVELOPER'; let allowed=admin||String(f.ownerID)===String(actor.userID);
  if(!allowed&&f.purpose==='LISTING_IMAGE'){const listing=by_('Listings','listingID',String(f.relatedID||'')); if(listing&&listing.status==='ACTIVE'&&Date.parse(String(listing.reconfirmDueAt||''))>Date.now()&&membershipStatus_(actor)==='ACTIVE'){const imgs=parseJson_(listing.imagesJson,[]);allowed=imgs.indexOf(String(f.fileID))>=0;}}
  if(!allowed&&f.purpose==='QR_CODE'){const settings=settingMap_();allowed=String(settings['payment.upiQrFileId']||'')===String(f.fileID);}
  if(!allowed) fail_('FORBIDDEN','You do not have access to this file.');
  const blob=DriveApp.getFileById(String(f.driveFileID)).getBlob(); return {fileName:String(f.fileName),mimeType:String(f.mimeType),base64:Utilities.base64Encode(blob.getBytes())};
}
function installScheduledBackups() { installScheduledBackups_(); }

function developerHealth_(d) { requireDeveloper_(String(d.actorID||'')); return systemHealth_(); }
function recordSecurityEvent_(d) {
  const event=String(d.eventType||'').slice(0,80); const subject=String(d.subject||'').slice(0,160);
  if(['AUTH_FAILURE','ACCOUNT_SUSPENDED_LOGIN','PASSWORD_RESET_REQUESTED','PASSWORD_RESET_COMPLETED','PASSWORD_CHANGED','RATE_LIMIT_SIGNAL'].indexOf(event)<0) fail_('INVALID_INPUT','Invalid security event.');
  securityLog_(String(d.actorID||''),event,subject,{ipHash:String(d.ipHash||''),userAgent:String(d.userAgent||''),details:d.details||{}});
  return {logged:true};
}
function updateMaintenance_(d) { const actor=requireDeveloper_(String(d.actorID||'')); const enabled=!!d.enabled; return withLock_(function(){updateSettings_(actor.userID,{'platform.maintenanceMode':enabled?'true':'false'});audit_(actor.userID,'MAINTENANCE_MODE_CHANGED','SETTINGS','platform.maintenanceMode',{enabled:enabled});return {enabled:enabled};}); }
function getOwnCredentials_(d) { const actor=roleUser_(String(d.actorID||''),['USER','ADMIN','DEVELOPER']); if(String(actor.userID)!==String(d.userID||'')) fail_('FORBIDDEN','You can only verify your own password.'); return {passwordHash:String(actor.passwordHash),passwordSalt:String(actor.passwordSalt)}; }
function changePassword_(d) { const actor=roleUser_(String(d.actorID||''),['USER','ADMIN','DEVELOPER']); if(String(actor.userID)!==String(d.userID||'')) fail_('FORBIDDEN','You can only change your own password.'); if(!/^[a-f0-9]{32}$/i.test(String(d.passwordSalt||''))||!/^[a-f0-9]{128}$/i.test(String(d.passwordHash||''))) fail_('INVALID_INPUT','Password verifier is invalid.'); return withLock_(function(){updateRow_('Users',actor._row,{passwordHash:d.passwordHash,passwordSalt:d.passwordSalt,updatedAt:nowIso_()});audit_(actor.userID,'PASSWORD_CHANGED','USER',actor.userID,{});securityLog_(actor.userID,'PASSWORD_CHANGED',actor.email,{ipHash:d.ipHash||'',userAgent:d.userAgent||'',details:{source:'settings'}});return {changed:true};}); }
