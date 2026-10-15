using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BookNook.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class MultipleFormats : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add the new bit-field column, copy each book's single format into it, then drop the old one.
            migrationBuilder.AddColumn<int>(
                name: "Formats",
                table: "UserBooks",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql("""
                UPDATE "UserBooks" SET "Formats" = CASE "Format"
                    WHEN 'Print' THEN 1
                    WHEN 'Ebook' THEN 2
                    WHEN 'Audiobook' THEN 4
                    ELSE 0 END;
                """);

            migrationBuilder.DropColumn(
                name: "Format",
                table: "UserBooks");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Format",
                table: "UserBooks",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            // Going back to a single format keeps the "strongest" one: audiobook, then e-book, then print.
            migrationBuilder.Sql("""
                UPDATE "UserBooks" SET "Format" = CASE
                    WHEN "Formats" & 4 <> 0 THEN 'Audiobook'
                    WHEN "Formats" & 2 <> 0 THEN 'Ebook'
                    WHEN "Formats" & 1 <> 0 THEN 'Print'
                    ELSE NULL END;
                """);

            migrationBuilder.DropColumn(
                name: "Formats",
                table: "UserBooks");
        }
    }
}
