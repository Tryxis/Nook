using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BookNook.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class GuestUsers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsGuest",
                table: "AspNetUsers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_IsGuest_CreatedAt",
                table: "AspNetUsers",
                columns: new[] { "IsGuest", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_IsGuest_CreatedAt",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "IsGuest",
                table: "AspNetUsers");
        }
    }
}
