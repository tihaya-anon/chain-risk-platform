package model

// PaginationRequest represents pagination parameters
type PaginationRequest struct {
	Page     int `form:"page" json:"page"`
	PageSize int `form:"pageSize" json:"pageSize"`
}

// PaginationResponse represents pagination metadata in response
type PaginationResponse struct {
	Page       int   `json:"page"`
	PageSize   int   `json:"pageSize"`
	TotalItems int64 `json:"totalItems"`
	TotalPages int   `json:"totalPages"`
}

// NewPaginationResponse creates a new PaginationResponse
func NewPaginationResponse(page, pageSize int, totalItems int64) PaginationResponse {
	totalPages := int(totalItems) / pageSize
	if int(totalItems)%pageSize > 0 {
		totalPages++
	}
	return PaginationResponse{
		Page:       page,
		PageSize:   pageSize,
		TotalItems: totalItems,
		TotalPages: totalPages,
	}
}

// TransferFilter represents filter options for transfers query
type TransferFilter struct {
	Address      string `form:"address"`
	FromAddress  string `form:"fromAddress"`
	ToAddress    string `form:"toAddress"`
	TokenAddress string `form:"tokenAddress"`
	TransferType string `form:"transferType"`
	Network      string `form:"network"`
	StartTime    string `form:"startTime"`
	EndTime      string `form:"endTime"`
	MinValue     string `form:"minValue"`
	MaxValue     string `form:"maxValue"`
}

// APIResponse is the standard API response wrapper
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *APIError   `json:"error,omitempty"`
	Meta    interface{} `json:"meta,omitempty"`
}

// APIError represents an API error
type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// NewSuccessResponse creates a success response
func NewSuccessResponse(data interface{}, meta interface{}) APIResponse {
	return APIResponse{
		Success: true,
		Data:    data,
		Meta:    meta,
	}
}

// NewErrorResponse creates an error response
func NewErrorResponse(code, message string) APIResponse {
	return APIResponse{
		Success: false,
		Error: &APIError{
			Code:    code,
			Message: message,
		},
	}
}

// ListResponse is a generic list response with pagination
type ListResponse[T any] struct {
	Items      []T                `json:"items"`
	Pagination PaginationResponse `json:"pagination"`
}
