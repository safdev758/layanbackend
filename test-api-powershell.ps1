# LAYAN E-commerce API Test Script for PowerShell

$BASE_URL = "http://localhost:3000/api/v1"

Write-Host "🧪 Testing LAYAN E-commerce API..." -ForegroundColor Green
Write-Host ""

# Function to make API requests
function Invoke-APIRequest {
    param(
        [string]$Method,
        [string]$Endpoint,
        [hashtable]$Headers = @{},
        [string]$Body = $null
    )
    
    $uri = "$BASE_URL$Endpoint"
    
    try {
        if ($Body) {
            $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $Headers -Body $Body -ContentType "application/json"
        } else {
            $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $Headers
        }
        return @{ Success = $true; Data = $response }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorMessage = $_.Exception.Message
        return @{ Success = $false; StatusCode = $statusCode; Error = $errorMessage }
    }
}

# Test 1: Get Categories (Public endpoint)
Write-Host "1. Testing GET /categories" -ForegroundColor Yellow
$categories = Invoke-APIRequest -Method "GET" -Endpoint "/categories"
if ($categories.Success) {
    Write-Host "✅ Success! Found $($categories.Data.Length) categories" -ForegroundColor Green
    if ($categories.Data.Length -gt 0) {
        Write-Host "   First category: $($categories.Data[0].name)" -ForegroundColor Cyan
    }
} else {
    Write-Host "❌ Failed: $($categories.Error)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Get Products (Public endpoint)
Write-Host "2. Testing GET /products" -ForegroundColor Yellow
$products = Invoke-APIRequest -Method "GET" -Endpoint "/products"
if ($products.Success) {
    Write-Host "✅ Success! Found $($products.Data.products.Length) products" -ForegroundColor Green
    if ($products.Data.products.Length -gt 0) {
        Write-Host "   First product: $($products.Data.products[0].name)" -ForegroundColor Cyan
    }
} else {
    Write-Host "❌ Failed: $($products.Error)" -ForegroundColor Red
}
Write-Host ""

# Test 3: User Signup
Write-Host "3. Testing POST /auth/signup" -ForegroundColor Yellow
$signupData = @{
    name = "Test User"
    email = "test@example.com"
    password = "password123"
    phone = "+1234567890"
} | ConvertTo-Json

$signup = Invoke-APIRequest -Method "POST" -Endpoint "/auth/signup" -Body $signupData
if ($signup.Success) {
    Write-Host "✅ Signup successful!" -ForegroundColor Green
    Write-Host "   User: $($signup.Data.user.name)" -ForegroundColor Cyan
    Write-Host "   Email: $($signup.Data.user.email)" -ForegroundColor Cyan
    
    # Store token for further tests
    $token = $signup.Data.token
    Write-Host "   Token: $($token.Substring(0, 20))..." -ForegroundColor Cyan
} else {
    Write-Host "❌ Signup failed: $($signup.Error)" -ForegroundColor Red
    # Try login instead
    Write-Host "   Trying login instead..." -ForegroundColor Yellow
    $loginData = @{
        email = "test@example.com"
        password = "password123"
    } | ConvertTo-Json
    
    $login = Invoke-APIRequest -Method "POST" -Endpoint "/auth/login" -Body $loginData
    if ($login.Success) {
        Write-Host "✅ Login successful!" -ForegroundColor Green
        $token = $login.Data.token
        Write-Host "   Token: $($token.Substring(0, 20))..." -ForegroundColor Cyan
    } else {
        Write-Host "❌ Login also failed: $($login.Error)" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# Test 4: Get User Profile (Protected endpoint)
Write-Host "4. Testing GET /users/me (with authentication)" -ForegroundColor Yellow
$headers = @{ "Authorization" = "Bearer $token" }
$profile = Invoke-APIRequest -Method "GET" -Endpoint "/users/me" -Headers $headers
if ($profile.Success) {
    Write-Host "✅ Profile retrieved successfully!" -ForegroundColor Green
    Write-Host "   Name: $($profile.Data.name)" -ForegroundColor Cyan
    Write-Host "   Email: $($profile.Data.email)" -ForegroundColor Cyan
    Write-Host "   Role: $($profile.Data.role)" -ForegroundColor Cyan
} else {
    Write-Host "❌ Failed: $($profile.Error)" -ForegroundColor Red
}
Write-Host ""

# Test 5: Update User Profile (Protected endpoint)
Write-Host "5. Testing PUT /users/me (with authentication)" -ForegroundColor Yellow
$updateData = @{
    name = "Updated Test User"
    phone = "+9876543210"
} | ConvertTo-Json

$update = Invoke-APIRequest -Method "PUT" -Endpoint "/users/me" -Headers $headers -Body $updateData
if ($update.Success) {
    Write-Host "✅ Profile updated successfully!" -ForegroundColor Green
    Write-Host "   New name: $($update.Data.name)" -ForegroundColor Cyan
    Write-Host "   New phone: $($update.Data.phone)" -ForegroundColor Cyan
} else {
    Write-Host "❌ Failed: $($update.Error)" -ForegroundColor Red
}
Write-Host ""

# Test 6: Get Cart (Protected endpoint)
Write-Host "6. Testing GET /cart (with authentication)" -ForegroundColor Yellow
$cart = Invoke-APIRequest -Method "GET" -Endpoint "/cart" -Headers $headers
if ($cart.Success) {
    Write-Host "✅ Cart retrieved successfully!" -ForegroundColor Green
    Write-Host "   Items: $($cart.Data.items.Length)" -ForegroundColor Cyan
    Write-Host "   Total: $$($cart.Data.totalAmount)" -ForegroundColor Cyan
} else {
    Write-Host "❌ Failed: $($cart.Error)" -ForegroundColor Red
}
Write-Host ""

Write-Host "🎉 API testing completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Working curl commands for reference:" -ForegroundColor Yellow
Write-Host "curl -X GET $BASE_URL/categories" -ForegroundColor White
Write-Host "curl -X GET $BASE_URL/users/me -H `"Authorization: Bearer $token`"" -ForegroundColor White
Write-Host "curl -X PUT $BASE_URL/users/me -H `"Authorization: Bearer $token`" -H `"Content-Type: application/json`" -d `"{\`"name\`":\`"New Name\`"}`"" -ForegroundColor White

