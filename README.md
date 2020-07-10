# transom-mongoose-localuser-googletoken
Add Google authentication to a Transom REST API.
This plugin should be used from PWAs or single page apps where you
cannot redirect the whole app to the google callback url.

Instead, you use google's sdk to login and pass the 
acquired access token to the endpoint created by this plugin, for validation.
The default end point (/prefix/user/googletoken) accepts a post request
and returns a JWT cookie to be used for subsequent requests.


